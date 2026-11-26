import { NextResponse, type NextRequest } from "next/server";
import { isSiteOwner } from "@/lib/auth-policy";
import { getAuth } from "@/server/auth";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MediaValidationError,
  storeUploadedImage,
} from "@/server/media";

// multipart 表单字段与边界预留 256KB 开销，超限在读 body 前快速拒绝。
const MAX_REQUEST_BYTES = MAX_MEDIA_UPLOAD_BYTES + 256 * 1024;

async function readBoundedFormData(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new MediaValidationError("请使用 multipart/form-data 上传图片。", 400);
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new MediaValidationError("请使用 multipart/form-data 上传图片。", 400);
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MediaValidationError("图片体积不能超过 10MB。", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": contentType },
    body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size),
  });
  return boundedRequest.formData();
}

export async function POST(request: NextRequest) {
  const auth = getAuth();
  if (!auth) {
    return NextResponse.json({ error: "认证服务未配置。" }, { status: 401 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "请先登录站长账号。" }, { status: 401 });
  }
  if (!isSiteOwner(session.user.email, session.user.emailVerified)) {
    return NextResponse.json({ error: "仅站长可上传媒体文件。" }, { status: 403 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "图片体积不能超过 10MB。" }, { status: 413 });
    }
  }

  let formData: FormData;
  try {
    formData = await readBoundedFormData(request);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "请使用 multipart/form-data 上传图片。" }, { status: 400 });
  }

  const kindValue = formData.get("kind");
  const kind = typeof kindValue === "string" ? kindValue.trim() : "";
  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "缺少要上传的图片文件。" }, { status: 400 });
  }
  if (fileValue.size > MAX_MEDIA_UPLOAD_BYTES) {
    return NextResponse.json({ error: "图片体积不能超过 10MB。" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const stored = await storeUploadedImage(buffer, kind);
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "图片上传失败，请稍后重试。" }, { status: 500 });
  }
}
