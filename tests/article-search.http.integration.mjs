import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import "./register-paths.mjs";

const projectRoot = new URL("../", import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { getPrisma } = await import("../src/server/db.ts");

const ownerEmail = "owner-search-42@example.test";
const authSecret = "lawson-search-42-http-test-secret-32-bytes";
const ownerSessionToken = `search-42-session-${randomUUID()}`;

let server;
let origin;
let serverOutput = "";
let testDirectory;
let composeArgs;
let testEnvironment;
let databaseUrl;
let prisma;
const originalDatabaseUrl = process.env.DATABASE_URL;

function sessionCookie(token) {
  const signature = createHmac("sha256", authSecret).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

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

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    env: testEnvironment,
    encoding: "utf8",
    timeout: 60_000,
    ...options,
  });
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeHtml(match[1]) : null;
}

async function submitArticleForm(path, html, intent, fields = {}) {
  const form = html.match(/<form\b[^>]*class="article-editor"[^>]*>[\s\S]*?<\/form>/);
  assert.ok(form, "文章编辑页应包含编辑表单");
  const formData = new FormData();
  for (const input of form[0].matchAll(/<input\b[^>]*>/g)) {
    const tag = input[0];
    const name = attribute(tag, "name");
    const value = attribute(tag, "value");
    const type = attribute(tag, "type");
    if (!name) continue;
    if (type === "checkbox") {
      if (/\bchecked(?:="")?/.test(tag)) formData.append(name, value ?? "");
    } else if (type === "hidden") {
      formData.append(name, value ?? "");
    } else {
      formData.set(name, value ?? "");
    }
  }
  for (const textarea of form[0].matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const name = attribute(`<textarea ${textarea[1]}>`, "name");
    if (name) formData.set(name, decodeHtml(textarea[2]));
  }
  for (const select of form[0].matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const name = attribute(`<select ${select[1]}>`, "name");
    const selected = [...select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)]
      .find((option) => /\bselected(?:="")?/.test(option[1]));
    if (name && selected) {
      formData.set(name, attribute(`<option ${selected[1]}>`, "value") ?? decodeHtml(selected[2]));
    }
  }
  for (const [name, value] of Object.entries(fields)) {
    formData.delete(name);
    if (Array.isArray(value)) {
      for (const item of value) formData.append(name, item);
    } else {
      formData.set(name, value);
    }
  }
  formData.set("intent", intent);

  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { cookie: sessionCookie(ownerSessionToken), origin },
    body: formData,
    redirect: "manual",
  });
}

function redirectPath(response) {
  const location = response.headers.get("location");
  if (location) return new URL(location, origin).pathname;
  const actionRedirect = response.headers.get("x-action-redirect");
  if (actionRedirect) return actionRedirect.split(";", 1)[0];
  return null;
}

async function prepareDatabase() {
  testDirectory = mkdtempSync(join(tmpdir(), "lawson-search-42-test-"));
  const composeFile = join(testDirectory, "compose.yaml");
  const envFile = join(testDirectory, ".env.test");
  const project = `lawson-test-42-${randomUUID().slice(0, 8)}`;
  testEnvironment = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    COMPOSE_FILE: composeFile,
    ENV_FILE: envFile,
  };
  composeArgs = ["compose", "-p", project, "-f", composeFile, "--env-file", envFile];
  writeFileSync(envFile, "");
  writeFileSync(
    composeFile,
    `services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
    ports:
      - "127.0.0.1::5432"
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U test -d test"]
      interval: 1s
      timeout: 1s
      retries: 20
`,
  );
  run("docker", [...composeArgs, "up", "-d", "--wait", "postgres"]);
  const address = run("docker", [...composeArgs, "port", "postgres", "5432"]).trim();
  databaseUrl = `postgresql://test:test@${address}/test`;
  testEnvironment.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
  run("pnpm", ["db:migrate:deploy"]);

  prisma = getPrisma();
  const owner = await prisma.user.create({
    data: {
      id: "search-42-owner",
      name: "Search Test Owner",
      email: ownerEmail,
      emailVerified: true,
    },
  });
  await prisma.session.create({
    data: {
      id: "search-42-owner-session",
      token: ownerSessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      userId: owner.id,
    },
  });

  await prisma.tag.createMany({
    data: [
      { id: "tag-ai", name: "AI" },
      { id: "tag-db", name: "Database" },
    ],
  });

  // 历史已发布中文文章（searchText 刻意留空，验证检索可用且读取不回填）
  await prisma.article.create({
    data: {
      id: "hist-zh-ai",
      slug: "hist-zh-ai",
      title: "历史语义检索笔记",
      excerpt: "记录连续中文词组与代码命中规则。",
      bodyLanguage: "zh",
      body: [
        "## 实现细节",
        "",
        "正文包含 **向量索引** 和 [权威指南](https://secret-url-only.example/hidden-slug)。",
        "",
        "```ts",
        "export const VECTOR_CODE_TOKEN = 'pg_ilike_ready';",
        "```",
      ].join("\n"),
      searchText: "",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-20T00:00:00.000Z"),
      tags: { connect: [{ id: "tag-ai" }] },
    },
  });

  // 英文已发布文章（无 AI 标签，带 Database 标签）
  await prisma.article.create({
    data: {
      id: "en-db-article",
      slug: "en-db-article",
      title: "PostgreSQL Caching Deep Dive",
      excerpt: "Case-insensitive search across English articles.",
      bodyLanguage: "en",
      body: "Use `CACHE_COMPONENT_TOKEN` and read [Prisma Docs](https://prisma-hidden-target.example/docs).",
      searchText: "",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-19T00:00:00.000Z"),
      tags: { connect: [{ id: "tag-db" }] },
    },
  });

  // 草稿与撤下文章（绝不应被搜索命中）
  await prisma.article.create({
    data: {
      id: "draft-hidden",
      slug: "draft-hidden",
      title: "草稿 VECTOR_CODE_TOKEN",
      excerpt: "草稿摘要",
      bodyLanguage: "zh",
      body: "草稿正文",
      searchText: "草稿 VECTOR_CODE_TOKEN 草稿摘要 草稿正文",
      status: "DRAFT",
    },
  });
  await prisma.article.create({
    data: {
      id: "withdrawn-hidden",
      slug: "withdrawn-hidden",
      title: "已撤下 VECTOR_CODE_TOKEN",
      excerpt: "撤下摘要",
      bodyLanguage: "zh",
      body: "撤下正文",
      searchText: "已撤下 VECTOR_CODE_TOKEN 撤下摘要 撤下正文",
      status: "WITHDRAWN",
      firstPublishedAt: new Date("2026-11-18T00:00:00.000Z"),
    },
  });

  // 多篇同关键词文章，用于验证关键词+标签组合与手动继续加载
  for (let i = 1; i <= 7; i += 1) {
    await prisma.article.create({
      data: {
        id: `batch-ai-${i}`,
        slug: `batch-ai-${i}`,
        title: `批次检索样例 ${i}`,
        excerpt: `用于验证组合筛选与加载更多 ${i}`,
        bodyLanguage: "zh",
        body: `共同关键词 BATCH_SEARCH_KEY 第 ${i} 篇。`,
        searchText: "",
        status: "PUBLISHED",
        firstPublishedAt: new Date(`2026-11-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`),
        tags: { connect: [{ id: "tag-ai" }] },
      },
    });
  }
}

async function startServer() {
  const port = await reservePort();
  origin = `http://127.0.0.1:${port}`;
  serverOutput = "";
  server = spawn(
    "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: authSecret,
        GOOGLE_CLIENT_ID: "test-google-client",
        GOOGLE_CLIENT_SECRET: "test-google-secret",
        ADMIN_EMAILS: ownerEmail,
      },
    },
  );
  server.stdout.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  server.stderr.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js 提前退出：\n${serverOutput}`);
    try {
      const response = await fetch(`${origin}/zh/articles`);
      if (response.status === 200) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Next.js 启动超时：\n${serverOutput}`);
}

before(
  async () => {
    await prepareDatabase();
    await startServer();
  },
  { timeout: 120_000 },
);

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), delay(5_000)]);
  }
  await prisma?.$disconnect();
  if (composeArgs) {
    try {
      run("docker", [...composeArgs, "down", "-v"]);
    } finally {
      rmSync(testDirectory, { recursive: true, force: true });
    }
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

test("按关键词检索已发布历史数据：命中标题/摘要/正文/代码/链接文字，不命中 Markdown 标记与链接目标，不返回草稿与撤下文章", async () => {
  // 标题/中文连续词组
  let html = await (await fetch(`${origin}/zh/articles?q=${encodeURIComponent("语义检索")}`)).text();
  assert.match(html, /历史语义检索笔记/);
  assert.doesNotMatch(html, /PostgreSQL Caching Deep Dive/);

  // 摘要
  html = await (await fetch(`${origin}/zh/articles?q=${encodeURIComponent("连续中文词组")}`)).text();
  assert.match(html, /历史语义检索笔记/);

  // 代码块（同时验证草稿与撤下文章不出现）
  html = await (await fetch(`${origin}/zh/articles?q=vector_code_token`)).text();
  assert.match(html, /历史语义检索笔记/);
  assert.doesNotMatch(html, /草稿 VECTOR_CODE_TOKEN/);
  assert.doesNotMatch(html, /已撤下 VECTOR_CODE_TOKEN/);

  // 链接可见文字
  html = await (await fetch(`${origin}/zh/articles?q=${encodeURIComponent("权威指南")}`)).text();
  assert.match(html, /历史语义检索笔记/);

  // 链接目标不参与匹配
  html = await (await fetch(`${origin}/zh/articles?q=secret-url-only`)).text();
  assert.doesNotMatch(html, /历史语义检索笔记/);
  assert.match(html, /清除筛选/);

  // Markdown 标记不参与匹配
  html = await (await fetch(`${origin}/zh/articles?q=${encodeURIComponent("## 实现细节")}`)).text();
  assert.doesNotMatch(html, /历史语义检索笔记/);
  assert.equal(
    (await prisma.article.findUnique({ where: { id: "hist-zh-ai" }, select: { searchText: true } })).searchText,
    "",
    "查询不能在缓存读取时写回历史文章",
  );
});

test("英文忽略大小写与跨界面语言搜索：中英文界面均能搜到任一正文语言的已发布文章", async () => {
  // 英文界面搜中文文章
  const enSearchingZh = await (
    await fetch(`${origin}/en/articles?q=${encodeURIComponent("向量索引")}`)
  ).text();
  assert.match(enSearchingZh, /历史语义检索笔记/);

  // 中文界面搜英文文章（忽略大小写 + 行内代码）
  const zhSearchingEn = await (
    await fetch(`${origin}/zh/articles?q=cache_component_token`)
  ).text();
  assert.match(zhSearchingEn, /PostgreSQL Caching Deep Dive/);

  const zhSearchingEnTitle = await (
    await fetch(`${origin}/zh/articles?q=postgresql+caching`)
  ).text();
  assert.match(zhSearchingEnTitle, /PostgreSQL Caching Deep Dive/);
});

test("关键词与标签组合、手动继续加载、标签切换回首批、详情标签清空关键词、失效标签保留关键词", async () => {
  // 关键词 + 标签组合，首批 6 篇并带加载更多链接（保留 q 与 tag）
  const combined = await (
    await fetch(`${origin}/zh/articles?q=BATCH_SEARCH_KEY&tag=tag-ai`)
  ).text();
  assert.match(combined, /批次检索样例 7/);
  assert.match(combined, /批次检索样例 2/);
  assert.doesNotMatch(combined, /批次检索样例 1</);
  assert.match(combined, /href="\/zh\/articles\?q=BATCH_SEARCH_KEY&amp;tag=tag-ai&amp;limit=12"/);

  // 搜索表单保留当前 tag 且不含 limit，确保提交关键词回到首批
  assert.match(combined, /<form\b[^>]*action="\/zh\/articles"[^>]*method="get"/i);
  assert.match(combined, /<input[^>]*type="hidden"[^>]*name="tag"[^>]*value="tag-ai"/);
  assert.doesNotMatch(combined, /<input[^>]*name="limit"/);

  // 手动继续加载第 2 批
  const loadedMore = await (
    await fetch(`${origin}/zh/articles?q=BATCH_SEARCH_KEY&tag=tag-ai&limit=12`)
  ).text();
  assert.match(loadedMore, /批次检索样例 1/);
  // 标签选择器链接保留 q 且不带 limit（切换标签回到首批）
  assert.match(loadedMore, /href="\/zh\/articles\?q=BATCH_SEARCH_KEY&amp;tag=tag-db"/);
  assert.match(loadedMore, /href="\/zh\/articles\?q=BATCH_SEARCH_KEY"/);

  // 详情页标签跳转清空关键词
  const detail = await (await fetch(`${origin}/zh/articles/hist-zh-ai`)).text();
  assert.match(detail, /href="\/zh\/articles\?tag=tag-ai"/);

  // 标签失效时保留关键词并提示
  const invalidTagWithQuery = await (
    await fetch(`${origin}/zh/articles?q=BATCH_SEARCH_KEY&tag=non-existent-tag&limit=12`)
  ).text();
  assert.match(invalidTagWithQuery, /所选标签已失效/);
  assert.match(invalidTagWithQuery, /批次检索样例 7/);
  // 回到首批（不包含第 7 条即最旧的样例 1）
  assert.doesNotMatch(invalidTagWithQuery, /批次检索样例 1</);

  // 组合无结果可清除筛选
  const emptyCombined = await (
    await fetch(`${origin}/zh/articles?q=BATCH_SEARCH_KEY&tag=tag-db`)
  ).text();
  assert.doesNotMatch(emptyCombined, /批次检索样例 7/);
  assert.match(emptyCombined, /href="\/zh\/articles"/);
  assert.match(emptyCombined, /清除筛选/);
});

test("发布、更新已发布文章同步维护搜索文本，撤下后立即退出搜索结果", async () => {
  const headers = { cookie: sessionCookie(ownerSessionToken) };
  const newEditor = await (await fetch(`${origin}/admin/articles/new`, { headers })).text();
  const slug = `live-search-${Date.now()}`;

  // 发布文章
  const publishRes = await submitArticleForm("/admin/articles/new", newEditor, "publish", {
    title: "实时搜索测试",
    excerpt: "初始摘要",
    bodyLanguage: "zh",
    body: "初始正文包含 INITIAL_LIVE_TOKEN 与 [点击这里](https://never-match-live.example/x)。",
    slug,
    tagIds: ["tag-ai"],
  });
  const editPath = redirectPath(publishRes);
  assert.ok(editPath?.startsWith("/admin/articles/"));

  let searchHtml = await (await fetch(`${origin}/zh/articles?q=initial_live_token&tag=tag-ai`)).text();
  assert.match(searchHtml, /实时搜索测试/);

  // 更新已发布文章
  const editHtml = await (await fetch(`${origin}${editPath}`, { headers })).text();
  const updateRes = await submitArticleForm(editPath, editHtml, "save", {
    title: "实时搜索测试",
    excerpt: "更新后摘要",
    bodyLanguage: "zh",
    body: "更新后正文包含 UPDATED_LIVE_TOKEN。",
    slug,
    tagIds: ["tag-ai"],
  });
  assert.equal(redirectPath(updateRes), editPath);

  searchHtml = await (await fetch(`${origin}/zh/articles?q=updated_live_token`)).text();
  assert.match(searchHtml, /实时搜索测试/);
  const oldTokenHtml = await (await fetch(`${origin}/zh/articles?q=initial_live_token`)).text();
  assert.doesNotMatch(oldTokenHtml, /实时搜索测试/);

  // 撤下文章后退出搜索结果
  const updatedEditHtml = await (await fetch(`${origin}${editPath}`, { headers })).text();
  const withdrawRes = await submitArticleForm(editPath, updatedEditHtml, "withdraw");
  assert.equal(redirectPath(withdrawRes), editPath);

  const afterWithdraw = await (await fetch(`${origin}/zh/articles?q=updated_live_token`)).text();
  assert.doesNotMatch(afterWithdraw, /实时搜索测试/);
});
