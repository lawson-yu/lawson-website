import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { makeSignature } from "better-auth/crypto";
import { Client } from "pg";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const containerName = `lawson-test-45-pg-${randomUUID()}`;
const authSecret = "lawson-issue-45-media-http-test-secret-32-bytes";
const ownerEmail = "owner45@example.test";
const visitorEmail = "visitor45@example.test";
const ownerSessionToken = `owner-session-${randomUUID()}`;
const visitorSessionToken = `visitor-session-${randomUUID()}`;

let server;
let origin;
let databaseUrl;
let serverOutput = "";
let ownerCookie;
let visitorCookie;
const uploadedKeys = [];

async function reservePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function createPngBuffer(width, height) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 16, g: 130, b: 190, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMeta(html, attrName, attrValue) {
  const pattern = new RegExp(
    `<meta[^>]*${attrName}="${escapeRegExp(attrValue)}"[^>]*content="([^"]+)"|<meta[^>]*content="([^"]+)"[^>]*${attrName}="${escapeRegExp(attrValue)}"`,
    "i",
  );
  const match = html.match(pattern);
  return match ? (match[1] ?? match[2]) : null;
}

function extractLinkHref(html, rel, hreflang) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of links) {
    const hasRel = new RegExp(`\\brel="${escapeRegExp(rel)}"`, "i").test(tag);
    if (!hasRel) continue;
    if (hreflang) {
      const hasLang = new RegExp(`\\bhreflang="${escapeRegExp(hreflang)}"`, "i").test(tag);
      if (!hasLang) continue;
    }
    const hrefMatch = tag.match(/\bhref="([^"]+)"/i);
    if (hrefMatch) return hrefMatch[1];
  }
  return null;
}

before(async () => {
  execFileSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-e",
      "POSTGRES_USER=test",
      "-e",
      "POSTGRES_PASSWORD=test",
      "-e",
      "POSTGRES_DB=test",
      "-p",
      "127.0.0.1::5432",
      "postgres:18-alpine",
    ],
    { encoding: "utf8" },
  );

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      execFileSync("docker", ["exec", containerName, "pg_isready", "-U", "test", "-d", "test"], {
        stdio: "ignore",
      });
      break;
    } catch {
      await delay(500);
    }
  }

  const mapped = execFileSync("docker", ["port", containerName, "5432/tcp"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")[0];
  databaseUrl = `postgresql://test:test@${mapped}/test`;

  execFileSync("pnpm", ["db:migrate:deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, 'Owner 45', $2, true, NOW(), NOW()),
            ($3, 'Visitor 45', $4, true, NOW(), NOW())`,
    ["owner-45", ownerEmail, "visitor-45", visitorEmail],
  );
  await db.query(
    `INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "userId")
     VALUES ($1, $2, $3, NOW(), NOW(), 'owner-45'),
            ($4, $2, $5, NOW(), NOW(), 'visitor-45')`,
    ["sess-owner-45", expiresAt, ownerSessionToken, "sess-visitor-45", visitorSessionToken],
  );
  await db.query(`INSERT INTO "Tag" ("id", "name") VALUES ('tag-45-ai', 'AI')`);
  await db.end();

  ownerCookie = `better-auth.session_token=${ownerSessionToken}.${await makeSignature(ownerSessionToken, authSecret)}`;
  visitorCookie = `better-auth.session_token=${visitorSessionToken}.${await makeSignature(visitorSessionToken, authSecret)}`;

  const port = await reservePort();
  origin = `http://127.0.0.1:${port}`;

  server = spawn(
    "pnpm",
    ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SITE_URL: origin,
        BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: authSecret,
        GOOGLE_CLIENT_ID: "test-client-id",
        GOOGLE_CLIENT_SECRET: "test-client-secret",
        ADMIN_EMAILS: ownerEmail,
        MEDIA_DRIVER: "local",
        MEDIA_PUBLIC_BASE_URL: "",
        MEDIA_BASE_URL: "",
      },
    },
  );
  server.stdout.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  server.stderr.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js 提前退出：\n${serverOutput}`);
    }
    try {
      const health = await fetch(`${origin}/api/health`);
      if (health.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Next.js 启动超时：\n${serverOutput}`);
}, { timeout: 60_000 });

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), delay(5_000)]);
  }
  for (const key of uploadedKeys) {
    await rm(join(root, "public", "uploads", key), { force: true });
  }
  try {
    execFileSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  } catch {
    // 忽略清理异常
  }
});

test("上传接口严格校验站长权限、格式、用途与体积上限", async () => {
  const png = await createPngBuffer(400, 300);

  const buildForm = (kind, bytes, filename = "sample.png", type = "image/png") => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", new Blob([bytes], { type }), filename);
    return form;
  };

  // 未登录 -> 401
  const unauth = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    body: buildForm("cover", png),
  });
  assert.equal(unauth.status, 401);

  // 非站长 -> 403
  const forbidden = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: visitorCookie },
    body: buildForm("cover", png),
  });
  assert.equal(forbidden.status, 403);

  // 非法格式 SVG -> 400
  const svgResp = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie },
    body: buildForm("body", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "bad.svg", "image/svg+xml"),
  });
  assert.equal(svgResp.status, 400);

  // 非法 kind -> 400
  const badKind = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie },
    body: buildForm("unknown", png),
  });
  assert.equal(badKind.status, 400);

  // 超 10MB -> 413
  const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);
  const tooLarge = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie },
    body: buildForm("body", bigBuffer, "huge.png"),
  });
  assert.equal(tooLarge.status, 413);

  const chunk = new Uint8Array(64 * 1024);
  const chunkedTooLarge = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie, "content-type": "multipart/form-data; boundary=oversized" },
    body: new ReadableStream({
      start(controller) {
        for (let index = 0; index < 165; index += 1) controller.enqueue(chunk);
        controller.close();
      },
    }),
    duplex: "half",
  });
  assert.equal(chunkedTooLarge.status, 413);
});

test("上传封面与正文图、公开展示、默认图回退、ADR 0006 元数据与收录边界全链路验证", async () => {
  // 1. 站长上传封面 (1200x630 JPEG) 与正文图 (最长边 1600 WebP)
  const coverForm = new FormData();
  coverForm.set("kind", "cover");
  coverForm.set("file", new Blob([await createPngBuffer(2200, 1400)], { type: "image/png" }), "cover.png");
  const coverResp = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie },
    body: coverForm,
  });
  assert.equal(coverResp.status, 201);
  const coverData = await coverResp.json();
  uploadedKeys.push(coverData.key);
  assert.match(coverData.key, /^media\/\d{4}\/\d{2}\/[a-f0-9-]+\.jpg$/);
  assert.equal(coverData.url, `/uploads/${coverData.key}`);

  const coverGet = await fetch(`${origin}${coverData.url}`);
  assert.equal(coverGet.status, 200);
  assert.equal(coverGet.headers.get("content-type"), "image/jpeg");
  const coverMeta = await sharp(Buffer.from(await coverGet.arrayBuffer())).metadata();
  assert.equal(coverMeta.format, "jpeg");
  assert.equal(coverMeta.width, 1200);
  assert.equal(coverMeta.height, 630);

  const bodyForm = new FormData();
  bodyForm.set("kind", "body");
  bodyForm.set("file", new Blob([await createPngBuffer(2000, 1000)], { type: "image/png" }), "diagram.png");
  const bodyResp = await fetch(`${origin}/api/admin/media`, {
    method: "POST",
    headers: { cookie: ownerCookie },
    body: bodyForm,
  });
  assert.equal(bodyResp.status, 201);
  const bodyData = await bodyResp.json();
  uploadedKeys.push(bodyData.key);
  assert.match(bodyData.key, /^media\/\d{4}\/\d{2}\/[a-f0-9-]+\.webp$/);

  const bodyGet = await fetch(`${origin}${bodyData.url}`);
  assert.equal(bodyGet.status, 200);
  assert.equal(bodyGet.headers.get("content-type"), "image/webp");
  const bodyMeta = await sharp(Buffer.from(await bodyGet.arrayBuffer())).metadata();
  assert.equal(bodyMeta.format, "webp");
  assert.equal(bodyMeta.width, 1600);
  assert.equal(bodyMeta.height, 800);

  // 路径穿越被拒绝
  const traversal = await fetch(`${origin}/uploads/..%2Fpackage.json`);
  assert.equal(traversal.status, 404);

  // 站点默认分享图可访问且为 1200x630 PNG
  const ogDefault = await fetch(`${origin}/og-default.png`);
  assert.equal(ogDefault.status, 200);
  assert.equal(ogDefault.headers.get("content-type"), "image/png");
  const ogMeta = await sharp(Buffer.from(await ogDefault.arrayBuffer())).metadata();
  assert.equal(ogMeta.width, 1200);
  assert.equal(ogMeta.height, 630);

  // 2. 写入带图/无图文章与带图/无图站内项目，验证公开页面展示与 SEO 元数据
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  await db.query(
    `INSERT INTO "Article" ("id", "slug", "title", "excerpt", "bodyLanguage", "body", "coverImageKey", "searchText", "status", "firstPublishedAt", "createdAt", "updatedAt")
     VALUES
       ('art-45-en', 'media-en-article', 'English Media Article', 'Testing cover and inline image.', 'en', $1, $2, 'English Media Article', 'PUBLISHED', '2026-11-25T00:00:00Z', NOW(), NOW()),
       ('art-45-zh-nocover', 'media-zh-nocover', '无封面中文文章', '测试默认列表图与默认分享图。', 'zh', '## 小节\n\n纯文字内容。', NULL, '无封面中文文章', 'PUBLISHED', '2026-11-24T00:00:00Z', NOW(), NOW())`,
    [`## Architecture\n\n![System Diagram](${bodyData.key})`, coverData.key],
  );
  await db.query(`INSERT INTO "_ArticleToTag" ("A", "B") VALUES ('art-45-en', 'tag-45-ai')`);
  await db.query(
    `INSERT INTO "Project" ("id", "slug", "name", "description", "type", "body", "contentLanguage", "cardTarget", "status", "coverImage", "firstPublishedAt", "createdAt", "updatedAt")
     VALUES
       ('proj-45-with-media', 'proj-with-media', 'Media Project', 'Project with cover and inline image.', '开发工具', $1, 'en', 'INTERNAL', 'PUBLISHED', $2, '2026-11-25T00:00:00Z', NOW(), NOW()),
       ('proj-45-nocover', 'proj-no-cover', '无封面作品', '用于验证作品默认列表图与默认分享图。', '开源项目', '## 简介\n\n无封面正文。', 'zh', 'INTERNAL', 'PUBLISHED', NULL, '2026-11-24T00:00:00Z', NOW(), NOW())`,
    [`## Showcase\n\n![Project Screenshot](${bodyData.key})`, coverData.key],
  );
  await db.end();

  // 3. 验证中文界面打开英文正文文章：html lang=zh，article lang=en，canonical/x-default=en，og:locale=en_US，og:image=封面绝对地址
  const articleHtml = await (await fetch(`${origin}/zh/articles/media-en-article`)).text();
  assert.match(articleHtml, /<html[^>]*\blang="zh"/i);
  assert.match(articleHtml, /<article[^>]*\blang="en"/i);
  assert.equal(extractLinkHref(articleHtml, "canonical"), `${origin}/en/articles/media-en-article`);
  assert.equal(extractLinkHref(articleHtml, "alternate", "zh"), `${origin}/zh/articles/media-en-article`);
  assert.equal(extractLinkHref(articleHtml, "alternate", "en"), `${origin}/en/articles/media-en-article`);
  assert.equal(extractLinkHref(articleHtml, "alternate", "x-default"), `${origin}/en/articles/media-en-article`);
  assert.equal(extractMeta(articleHtml, "property", "og:image"), `${origin}${coverData.url}`);
  assert.equal(extractMeta(articleHtml, "property", "og:locale"), "en_US");
  assert.ok(articleHtml.includes(coverData.url), "文章详情应展示封面图");
  assert.ok(articleHtml.includes(bodyData.url), "文章详情应展示正文插图");

  // 4. 无封面文章：列表展示默认列表图，详情分享图回退 /og-default.png
  const articlesListHtml = await (await fetch(`${origin}/zh/articles`)).text();
  assert.ok(articlesListHtml.includes("/images/prototype/article-list/fragment.webp"));
  assert.doesNotMatch(extractMeta(articlesListHtml, "name", "robots") ?? "", /noindex/i);

  const noCoverArticleHtml = await (await fetch(`${origin}/en/articles/media-zh-nocover`)).text();
  assert.equal(extractLinkHref(noCoverArticleHtml, "canonical"), `${origin}/zh/articles/media-zh-nocover`);
  assert.equal(extractMeta(noCoverArticleHtml, "property", "og:image"), `${origin}/og-default.png`);
  assert.equal(extractMeta(noCoverArticleHtml, "property", "og:locale"), "zh_CN");

  // 5. 站内项目详情：带封面+正文图 & 无封面默认列表图/默认分享图
  const projectsListHtml = await (await fetch(`${origin}/zh/projects`)).text();
  assert.ok(projectsListHtml.includes("/images/prototype/article-list/fragment.webp"));
  assert.ok(projectsListHtml.includes(coverData.url));
  assert.doesNotMatch(extractMeta(projectsListHtml, "name", "robots") ?? "", /noindex/i);

  const projectWithMediaHtml = await (await fetch(`${origin}/zh/projects/proj-with-media`)).text();
  assert.match(projectWithMediaHtml, /<html[^>]*\blang="zh"/i);
  assert.match(projectWithMediaHtml, /<article[^>]*\blang="en"/i);
  assert.equal(extractLinkHref(projectWithMediaHtml, "canonical"), `${origin}/en/projects/proj-with-media`);
  assert.equal(extractLinkHref(projectWithMediaHtml, "alternate", "x-default"), `${origin}/en/projects/proj-with-media`);
  assert.equal(extractLinkHref(projectWithMediaHtml, "alternate", "zh"), `${origin}/zh/projects/proj-with-media`);
  assert.equal(extractLinkHref(projectWithMediaHtml, "alternate", "en"), `${origin}/en/projects/proj-with-media`);
  assert.equal(extractMeta(projectWithMediaHtml, "property", "og:image"), `${origin}${coverData.url}`);
  assert.equal(extractMeta(projectWithMediaHtml, "property", "og:locale"), "en_US");
  assert.ok(projectWithMediaHtml.includes(coverData.url), "项目详情应展示封面图");
  assert.ok(projectWithMediaHtml.includes(bodyData.url), "项目详情应展示 Markdown 正文图");

  const projectNoCoverHtml = await (await fetch(`${origin}/en/projects/proj-no-cover`)).text();
  assert.equal(extractLinkHref(projectNoCoverHtml, "canonical"), `${origin}/zh/projects/proj-no-cover`);
  assert.equal(extractMeta(projectNoCoverHtml, "property", "og:image"), `${origin}/og-default.png`);
  assert.equal(extractMeta(projectNoCoverHtml, "property", "og:locale"), "zh_CN");

  // 6. 筛选与加载状态地址不作为独立收录目标
  const filteredListHtml = await (await fetch(`${origin}/zh/articles?tag=tag-45-ai`)).text();
  assert.match(extractMeta(filteredListHtml, "name", "robots") ?? "", /noindex/i);
  assert.equal(extractLinkHref(filteredListHtml, "canonical"), `${origin}/zh/articles`);

  const loadedMoreHtml = await (await fetch(`${origin}/zh/articles?limit=12`)).text();
  assert.match(extractMeta(loadedMoreHtml, "name", "robots") ?? "", /noindex/i);

  // 7. 首页、robots.txt 与 sitemap.xml
  const homeHtml = await (await fetch(`${origin}/zh`)).text();
  assert.doesNotMatch(extractMeta(homeHtml, "name", "robots") ?? "", /noindex/i);
  assert.equal(extractLinkHref(homeHtml, "canonical"), `${origin}/zh`);
  assert.equal(extractMeta(homeHtml, "property", "og:image"), `${origin}/og-default.png`);

  const robotsTxt = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robotsTxt, /Disallow: \/admin/i);
  assert.match(robotsTxt, /Sitemap:/i);

  const sitemapXml = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.ok(sitemapXml.includes(`${origin}/en/articles/media-en-article`));
  assert.ok(sitemapXml.includes(`${origin}/en/projects/proj-with-media`));
  assert.ok(sitemapXml.includes(`${origin}/zh/articles`));
  assert.ok(sitemapXml.includes(`${origin}/zh/projects`));
});
