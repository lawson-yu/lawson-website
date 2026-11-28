import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import sharp from "sharp";
import "./register-paths.mjs";

const {
  DEFAULT_CARD_COVER_PATH,
  DEFAULT_OG_IMAGE_PATH,
  isSafeMediaKey,
  resolveAbsoluteMediaUrl,
  resolveMediaUrl,
} = await import("../src/lib/media-url.ts");
const {
  MAX_MEDIA_UPLOAD_BYTES,
  MediaValidationError,
  normalizeUploadedImage,
  readLocalMediaFile,
  storeUploadedImage,
} = await import("../src/server/media.ts");

async function createPng(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 24, g: 120, b: 196, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("媒体路径安全与 URL 解析", () => {
  test("校验合法相对 key 并拒绝路径穿越和危险协议", () => {
    assert.equal(isSafeMediaKey("media/2026/11/sample.webp"), true);
    assert.equal(isSafeMediaKey("media/2026/11/cover.jpg"), true);
    assert.equal(isSafeMediaKey("../etc/passwd"), false);
    assert.equal(isSafeMediaKey("media/../../secret.txt"), false);
    assert.equal(isSafeMediaKey("/etc/passwd"), false);
    assert.equal(isSafeMediaKey("media\\windows.jpg"), false);
    assert.equal(isSafeMediaKey("javascript:alert(1)"), false);
    assert.equal(isSafeMediaKey("data:image/png;base64,abc"), false);
    assert.equal(isSafeMediaKey(""), false);
  });

  test("本地与 COS 模式下正确拼接公开媒体地址与绝对地址", () => {
    assert.equal(DEFAULT_CARD_COVER_PATH, "/images/prototype/article-list/fragment.webp");
    assert.equal(DEFAULT_OG_IMAGE_PATH, "/og-default.png");

    assert.equal(
      resolveMediaUrl("media/2026/11/a.webp", { mediaBaseUrl: "" }),
      "/uploads/media/2026/11/a.webp",
    );
    assert.equal(
      resolveMediaUrl("media/2026/11/a.webp", { mediaBaseUrl: "https://media.lawson-codes.dev/" }),
      "https://media.lawson-codes.dev/media/2026/11/a.webp",
    );
    assert.equal(
      resolveMediaUrl("/images/prototype/article-list/fragment.webp", { mediaBaseUrl: "https://media.lawson-codes.dev" }),
      "/images/prototype/article-list/fragment.webp",
    );
    assert.equal(resolveMediaUrl("../secret.png"), null);

    assert.equal(
      resolveAbsoluteMediaUrl("media/2026/11/cover.jpg", {
        siteOrigin: "https://lawson-codes.dev",
        mediaBaseUrl: "",
      }),
      "https://lawson-codes.dev/uploads/media/2026/11/cover.jpg",
    );
    assert.equal(
      resolveAbsoluteMediaUrl("media/2026/11/cover.jpg", {
        siteOrigin: "https://lawson-codes.dev",
        mediaBaseUrl: "https://media.lawson-codes.dev",
      }),
      "https://media.lawson-codes.dev/media/2026/11/cover.jpg",
    );
  });
});

describe("sharp 图片归一化与输入校验", () => {
  test("封面归一化为 1200x630 JPEG", async () => {
    const input = await createPng(2400, 1600);
    const result = await normalizeUploadedImage(input, "cover");

    assert.equal(result.contentType, "image/jpeg");
    assert.equal(result.extension, "jpg");
    assert.equal(result.width, 1200);
    assert.equal(result.height, 630);

    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);
  });

  test("正文图按最长边 1600 等比归一化为 WebP，小图不放大", async () => {
    const large = await createPng(2400, 1200);
    const largeResult = await normalizeUploadedImage(large, "body");
    assert.equal(largeResult.contentType, "image/webp");
    assert.equal(largeResult.extension, "webp");
    assert.equal(largeResult.width, 1600);
    assert.equal(largeResult.height, 800);

    const small = await createPng(640, 480);
    const smallResult = await normalizeUploadedImage(small, "body");
    assert.equal(smallResult.contentType, "image/webp");
    assert.equal(smallResult.width, 640);
    assert.equal(smallResult.height, 480);
  });

  test("拒绝非法格式、超限体积和非法用途", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await assert.rejects(
      () => normalizeUploadedImage(svg, "body"),
      (err) => err instanceof MediaValidationError && err.status === 400,
    );

    const oversized = Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1);
    await assert.rejects(
      () => normalizeUploadedImage(oversized, "cover"),
      (err) => err instanceof MediaValidationError && err.status === 413,
    );

    const valid = await createPng(400, 400);
    await assert.rejects(
      () => normalizeUploadedImage(valid, "avatar"),
      (err) => err instanceof MediaValidationError && err.status === 400,
    );
  });
});

describe("本地与硅谷 COS 存储驱动", () => {
  test("local 驱动落盘相对 key 并可安全读取", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "lawson-media-local-"));
    try {
      const input = await createPng(800, 600);
      const uploaded = await storeUploadedImage(input, "cover", {
        driver: "local",
        localRootDir: tempDir,
        mediaBaseUrl: "",
        now: new Date("2026-11-26T00:00:00Z"),
      });

      assert.match(uploaded.key, /^media\/2026\/11\/[a-f0-9-]+\.jpg$/);
      assert.equal(uploaded.url, `/uploads/${uploaded.key}`);
      assert.equal(uploaded.width, 1200);
      assert.equal(uploaded.height, 630);

      const diskBytes = await readFile(join(tempDir, uploaded.key));
      assert.ok(diskBytes.byteLength > 0);

      const loaded = await readLocalMediaFile(uploaded.key, tempDir);
      assert.equal(loaded?.contentType, "image/jpeg");
      assert.equal(loaded?.buffer.byteLength, diskBytes.byteLength);

      const blocked = await readLocalMediaFile("../package.json", tempDir);
      assert.equal(blocked, null);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("cos 驱动向硅谷桶写入对象并返回自定义域名 URL", async () => {
    const calls = [];
    const fakeCosClient = {
      async putObject(params) {
        calls.push(params);
        return { statusCode: 200 };
      },
    };
    const input = await createPng(2000, 1000);
    const uploaded = await storeUploadedImage(input, "body", {
      driver: "cos",
      cosClient: fakeCosClient,
      cosBucket: "lawson-media-1250000000",
      cosRegion: "na-siliconvalley",
      cosPrefix: "media",
      mediaBaseUrl: "https://media.lawson-codes.dev",
      now: new Date("2026-11-26T00:00:00Z"),
    });

    assert.match(uploaded.key, /^media\/2026\/11\/[a-f0-9-]+\.webp$/);
    assert.equal(uploaded.url, `https://media.lawson-codes.dev/${uploaded.key}`);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].Bucket, "lawson-media-1250000000");
    assert.equal(calls[0].Region, "na-siliconvalley");
    assert.equal(calls[0].Key, uploaded.key);
    assert.equal(calls[0].ContentType, "image/webp");
    assert.equal(calls[0].CacheControl, "public, max-age=31536000, immutable");
    assert.ok(Buffer.isBuffer(calls[0].Body));
  });
});
