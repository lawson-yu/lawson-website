import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import COS from "cos-nodejs-sdk-v5";
import sharp, { type Metadata } from "sharp";
import { isSafeMediaKey, resolveMediaUrl } from "@/lib/media-url";

export type MediaKind = "cover" | "body";
export type MediaDriver = "local" | "cos";

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;
export const BODY_MAX_EDGE = 1600;
export const DEFAULT_COS_REGION = "na-siliconvalley";
export const DEFAULT_MEDIA_PREFIX = "media";

const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
  avif: "image/avif",
};

export class MediaValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MediaValidationError";
    this.status = status;
  }
}

export type NormalizedImage = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/webp";
  extension: "jpg" | "webp";
  width: number;
  height: number;
  size: number;
};

export type CosPutObjectClient = {
  putObject(params: {
    Bucket: string;
    Region: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
    CacheControl: string;
  }): Promise<unknown>;
};

export type StoreUploadedImageOptions = {
  driver?: MediaDriver;
  localRootDir?: string;
  mediaBaseUrl?: string;
  cosClient?: CosPutObjectClient;
  cosBucket?: string;
  cosRegion?: string;
  cosPrefix?: string;
  now?: Date;
};

export type StoredMediaResult = {
  key: string;
  url: string;
  contentType: "image/jpeg" | "image/webp";
  width: number;
  height: number;
  size: number;
};

export function getDefaultLocalUploadRoot(): string {
  return join(process.cwd(), "public", "uploads");
}

export function resolveMediaDriver(explicit?: MediaDriver): MediaDriver {
  if (explicit) return explicit;
  const env = process.env.MEDIA_DRIVER?.trim().toLowerCase();
  if (env === "cos") return "cos";
  if (env === "local") return "local";
  return process.env.COS_BUCKET && process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY
    ? "cos"
    : "local";
}

function sanitizePrefix(prefix: string | undefined): string {
  const cleaned = (prefix ?? DEFAULT_MEDIA_PREFIX).trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned || !/^[a-z0-9][a-z0-9/_-]*$/i.test(cleaned) || cleaned.includes("..")) {
    return DEFAULT_MEDIA_PREFIX;
  }
  return cleaned;
}

export async function normalizeUploadedImage(
  input: Buffer,
  kind: string,
): Promise<NormalizedImage> {
  if (kind !== "cover" && kind !== "body") {
    throw new MediaValidationError("上传类型无效，仅支持 cover 或 body。", 400);
  }
  if (!input.byteLength) {
    throw new MediaValidationError("请选择要上传的图片文件。", 400);
  }
  if (input.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
    throw new MediaValidationError("图片体积不能超过 10MB。", 413);
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new MediaValidationError("无法解析图片文件，请上传有效的 JPEG、PNG、WebP 或 AVIF 图片。", 400);
  }

  if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
    throw new MediaValidationError("仅支持 JPEG、PNG、WebP 或 AVIF 格式的图片。", 400);
  }

  // .rotate() 按 EXIF 方向矫正像素，输出时默认剥离 EXIF 隐私元数据。
  if (kind === "cover") {
    const { data, info } = await sharp(input)
      .rotate()
      .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      contentType: "image/jpeg",
      extension: "jpg",
      width: info.width,
      height: info.height,
      size: data.byteLength,
    };
  }

  const { data, info } = await sharp(input)
    .rotate()
    .resize({
      width: BODY_MAX_EDGE,
      height: BODY_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: "image/webp",
    extension: "webp",
    width: info.width,
    height: info.height,
    size: data.byteLength,
  };
}

function createMediaKey(extension: "jpg" | "webp", prefix: string, now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${year}/${month}/${randomUUID()}.${extension}`;
}

function createCosClient(): CosPutObjectClient {
  const secretId = process.env.COS_SECRET_ID?.trim();
  const secretKey = process.env.COS_SECRET_KEY?.trim();
  if (!secretId || !secretKey) {
    throw new MediaValidationError("服务端缺少 COS_SECRET_ID 或 COS_SECRET_KEY 配置。", 500);
  }
  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
  return {
    putObject(params) {
      return new Promise((resolvePromise, reject) => {
        cos.putObject(params, (error, data) => {
          if (error) reject(error);
          else resolvePromise(data);
        });
      });
    },
  };
}

export async function storeUploadedImage(
  input: Buffer,
  kind: string,
  options: StoreUploadedImageOptions = {},
): Promise<StoredMediaResult> {
  const normalized = await normalizeUploadedImage(input, kind);
  const driver = resolveMediaDriver(options.driver);
  const prefix = sanitizePrefix(options.cosPrefix ?? process.env.COS_MEDIA_PREFIX);
  const key = createMediaKey(normalized.extension, prefix, options.now ?? new Date());

  if (driver === "cos") {
    const bucket = (options.cosBucket ?? process.env.COS_BUCKET ?? "").trim();
    const region = (options.cosRegion ?? process.env.COS_REGION ?? DEFAULT_COS_REGION).trim();
    if (!bucket) {
      throw new MediaValidationError("服务端缺少 COS_BUCKET 配置。", 500);
    }
    const client = options.cosClient ?? createCosClient();
    await client.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: normalized.buffer,
      ContentType: normalized.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });
  } else {
    const rootDir = resolve(/*turbopackIgnore: true*/ options.localRootDir ?? getDefaultLocalUploadRoot());
    const targetPath = resolve(/*turbopackIgnore: true*/ rootDir, key);
    if (!targetPath.startsWith(`${rootDir}/`) && targetPath !== rootDir) {
      throw new MediaValidationError("媒体写入路径非法。", 400);
    }
    await mkdir(/*turbopackIgnore: true*/ dirname(targetPath), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ targetPath, normalized.buffer);
  }

  const url = resolveMediaUrl(key, { mediaBaseUrl: options.mediaBaseUrl }) ?? `/uploads/${key}`;
  return {
    key,
    url,
    contentType: normalized.contentType,
    width: normalized.width,
    height: normalized.height,
    size: normalized.size,
  };
}

/**
 * 安全读取本地 uploads 目录下的文件，防止路径穿越。
 */
export async function readLocalMediaFile(
  key: string,
  localRootDir = getDefaultLocalUploadRoot(),
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeMediaKey(key)) return null;

  const rootDir = resolve(/*turbopackIgnore: true*/ localRootDir);
  const targetPath = resolve(/*turbopackIgnore: true*/ rootDir, key);
  if (!targetPath.startsWith(`${rootDir}/`)) return null;

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;

  try {
    const buffer = await readFile(/*turbopackIgnore: true*/ targetPath);
    return { buffer, contentType };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
