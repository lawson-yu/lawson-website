import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import "./register-paths.mjs";

const projectRoot = new URL("../", import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { getPrisma } = await import("../src/server/db.ts");
let server;
let origin;
let serverOutput = "";
let browser;
let testDirectory;
let composeFile;
let envFile;
let composeArgs;
let testEnvironment;
let databaseUrl;
let prisma;
const originalDatabaseUrl = process.env.DATABASE_URL;
const ownerEmail = "owner@example.test";
const authSecret = "lawson-site-settings-http-test-secret-32-bytes";

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

async function prepareDatabase() {
  testDirectory = mkdtempSync(join(tmpdir(), "lawson-site-http-test-"));
  composeFile = join(testDirectory, "compose.yaml");
  envFile = join(testDirectory, ".env.test");
  const project = `lawson-http-${randomUUID().slice(0, 8)}`;
  testEnvironment = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    COMPOSE_FILE: composeFile,
    ENV_FILE: envFile,
  };
  composeArgs = ["compose", "-p", project, "-f", composeFile, "--env-file", envFile];
  writeFileSync(envFile, "");
  writeFileSync(composeFile, `services:
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
`);
  run("docker", [...composeArgs, "up", "-d", "--wait", "postgres"]);
  const address = run("docker", [...composeArgs, "port", "postgres", "5432"]).trim();
  databaseUrl = `postgresql://test:test@${address}/test`;
  testEnvironment.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
  run("pnpm", ["db:migrate:deploy"]);
  run("pnpm", ["db:seed"]);
  prisma = getPrisma();
  await prisma.project.create({
    data: {
      id: "http-internal",
      slug: "http-internal",
      name: "测试内链作品",
      description: "展示 Markdown 项目详情。",
      type: "实验作品",
      body: "## 项目背景\n\n这是通过 HTTP 验证的项目正文。\n\n访问 [示例入口](https://trace.example)。",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "PUBLISHED",
      url: "https://trace.example",
      firstPublishedAt: new Date("2024-09-08T00:00:00Z"),
      createdAt: new Date("2024-09-08T00:00:00Z"),
      updatedAt: new Date("2024-09-08T00:00:00Z"),
    },
  });
  await prisma.project.create({
    data: {
      id: "http-withdrawn",
      slug: "http-withdrawn",
      name: "已撤下作品",
      description: "不应公开。",
      type: "实验作品",
      body: "## 草稿",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "WITHDRAWN",
      firstPublishedAt: new Date("2024-09-09T00:00:00Z"),
      createdAt: new Date("2024-09-09T00:00:00Z"),
      updatedAt: new Date("2024-09-09T00:00:00Z"),
    },
  });
  await prisma.article.create({
    data: {
      id: "http-article-ai",
      slug: "http-article-ai",
      title: "AI 技术文章",
      excerpt: "带有 AI 标签的公开文章。",
      bodyLanguage: "zh",
      body: "## AI 实践\n\n这篇文章用于验证标签入口。",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-21T00:00:00.000Z"),
      tags: { create: [{ id: "http-tag-ai", name: "AI" }] },
    },
  });
  await prisma.article.create({
    data: {
      id: "http-article-writing",
      slug: "http-article-writing",
      title: "未筛选的写作文章",
      excerpt: "这篇文章没有 AI 标签。",
      bodyLanguage: "zh",
      body: "## 写作\n\n用于检验标签筛选。",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-20T00:00:00.000Z"),
    },
  });
  for (const [id, title, firstPublishedAt] of [
    ["http-article-new", "较新的文章", "2026-11-19T00:00:00.000Z"],
    ["http-article-tie-a", "同日文章 A", "2026-11-18T00:00:00.000Z"],
    ["http-article-tie-b", "同日文章 B", "2026-11-18T00:00:00.000Z"],
    ["http-article-old-a", "较早文章 A", "2026-11-17T00:00:00.000Z"],
    ["http-article-old-b", "较早文章 B", "2026-11-16T00:00:00.000Z"],
    ["http-article-old-c", "较早文章 C", "2026-11-15T00:00:00.000Z"],
  ]) {
    await prisma.article.create({
      data: {
        id,
        slug: id,
        title,
        excerpt: "连续浏览验收文章。",
        bodyLanguage: "zh",
        body: "## 正文\n\n隔离验收数据。",
        status: "PUBLISHED",
        firstPublishedAt: new Date(firstPublishedAt),
      },
    });
  }
}

async function startServer(authenticated = false) {
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
        BETTER_AUTH_URL: authenticated ? origin : "",
        BETTER_AUTH_SECRET: authenticated ? authSecret : "",
        GOOGLE_CLIENT_ID: authenticated ? "test-google-client" : "",
        GOOGLE_CLIENT_SECRET: authenticated ? "test-google-secret" : "",
        ADMIN_EMAILS: authenticated ? ownerEmail : "",
      },
    },
  );
  server.stdout.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  server.stderr.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js 提前退出：\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${origin}/zh`);
      if (response.status === 200) {
        browser ??= await chromium.launch({
          args: ["--enable-webgl", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
        });
        return;
      }
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Next.js 启动超时：\n${serverOutput}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    server = undefined;
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(5_000)]);
  server = undefined;
}

before(async () => {
  await prepareDatabase();
  await startServer();
}, { timeout: 125_000 });

after(async () => {
  await browser?.close();
  await stopServer();
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

function sessionCookie(token) {
  const signature = createHmac("sha256", authSecret).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

function getActionForm(html) {
  const form = html.match(
    /<form\b[^>]*class="admin-settings-form"[^>]*>[\s\S]*?<\/form>/,
  )?.[0];
  assert.ok(form, "后台应显示首页设置表单");
  const actionFields = [];
  for (const [input] of form.matchAll(/<input\b[^>]*>/g)) {
    const name = input.match(/\bname="([^"]+)"/)?.[1];
    if (!name?.startsWith("$ACTION_")) continue;
    const value = (input.match(/\bvalue="([^"]*)"/)?.[1] ?? "")
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
    actionFields.push([name, value]);
  }
  assert.ok(actionFields.length > 0, "Server Action 表单应带有请求标记");

  return (values) => {
    const formData = new FormData();
    for (const [name, value] of actionFields) formData.append(name, value);
    formData.set("heroIntroduction", values.heroIntroduction);
    formData.set("contactUrl", values.contactUrl);
    formData.set("socialLinks", JSON.stringify(values.socialLinks));
    return formData;
  };
}

async function postSettings(values, cookie) {
  return fetch(`${origin}/admin`, {
    method: "POST",
    headers: {
      ...(cookie ? { cookie } : {}),
      origin,
      referer: `${origin}/admin`,
    },
    body: values,
    redirect: "manual",
  });
}

function getProjectForm(html, predicate) {
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map((match) => match[0]);
  const form = forms.find(predicate);
  assert.ok(form, "页面上应找到目标作品表单");
  return [...form.matchAll(/<input\b[^>]*>/g)]
    .map(([input]) => {
      const attributes = Object.fromEntries(
        [...input.matchAll(/\b(name|value|type)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
      );
      return attributes;
    })
    .filter((input) => input.type === "hidden" && input.name)
    .map(({ name, value = "" }) => [
      name,
      value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&"),
    ]);
}

async function submitProjectAction(path, hiddenFields, values, cookie) {
  const formData = new FormData();
  for (const [name, value] of hiddenFields) formData.set(name, value);
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}), origin, referer: `${origin}${path}` },
    body: formData,
    redirect: "manual",
  });
}

async function expectConfirmation(page, button, expectedMessage) {
  const dialogEvent = page.waitForEvent("dialog", { timeout: 5_000 });
  const click = button.click();
  const dialog = await dialogEvent;
  assert.equal(dialog.message(), expectedMessage);
  await dialog.dismiss();
  await click;
}

test("根路径固定 301 到简体中文首页", async () => {
  const response = await fetch(`${origin}/`, {
    redirect: "manual",
    headers: { "accept-language": "en-US,en;q=0.9" },
  });

  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/zh");
});

test("访客可从列表或详情标签进入该主题，并清除失效标签", async () => {
  for (const locale of ["zh", "en"]) {
    const listResponse = await fetch(`${origin}/${locale}/articles`);
    const list = await listResponse.text();
    assert.equal(listResponse.status, 200);
    assert.match(list, /AI 技术文章/);
    assert.match(list, /未筛选的写作文章/);
    assert.match(list, /src="\/images\/prototype\/article-list\/fragment\.webp"/);

    const filteredResponse = await fetch(`${origin}/${locale}/articles?tag=http-tag-ai`);
    const filtered = await filteredResponse.text();
    assert.equal(filteredResponse.status, 200);
    assert.match(filtered, /AI 技术文章/);
    assert.doesNotMatch(filtered, /未筛选的写作文章/);
    assert.match(filtered, new RegExp(`href="/${locale}/articles\\?tag=http-tag-ai"`));

    const detailResponse = await fetch(`${origin}/${locale}/articles/http-article-ai`);
    const detail = await detailResponse.text();
    assert.equal(detailResponse.status, 200);
    assert.match(detail, new RegExp(`href="/${locale}/articles\\?tag=http-tag-ai"`));

    const invalidResponse = await fetch(`${origin}/${locale}/articles?tag=deleted-tag`);
    const invalid = await invalidResponse.text();
    assert.equal(invalidResponse.status, 200);
    assert.match(invalid, /标签.*失效|selected tag is no longer available/i);
    assert.match(invalid, /AI 技术文章/);
    assert.match(invalid, /未筛选的写作文章/);
  }
});

test("文章列表按发布时间和 ID 排序，并可手动增量加载", { timeout: 30_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh/articles`);
    const cards = page.locator(".articles-index__grid > li");
    await page.waitForFunction(() => document.querySelectorAll(".articles-index__grid > li").length > 0);
    assert.equal(await cards.count(), 6);
    assert.deepEqual(await cards.locator(".article-card__title:visible").allTextContents(), [
      "AI 技术文章",
      "未筛选的写作文章",
      "较新的文章",
      "同日文章 B",
      "同日文章 A",
      "较早文章 A",
    ]);

    await page.getByRole("link", { name: "加载更多文章" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".articles-index__grid > li").length === 8);
    assert.deepEqual((await cards.locator(".article-card__title:visible").allTextContents()).slice(-2), [
      "较早文章 B",
      "较早文章 C",
    ]);
    assert.equal(await page.getByRole("link", { name: "加载更多文章" }).count(), 0);
  } finally {
    await context.close();
  }
});

test("文章详情可读长文并从筛选结果恢复浏览状态", { timeout: 45_000 }, async () => {
  const articleId = "http-article-old-c";
  const longArticleId = `http-article-long-${randomUUID()}`;
  const tagId = "http-tag-ai";
  const articleIds = [
    "http-article-ai",
    "http-article-writing",
    "http-article-new",
    "http-article-tie-a",
    "http-article-tie-b",
    "http-article-old-a",
    "http-article-old-b",
    articleId,
  ];
  const originalTags = await prisma.article.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, tags: { select: { id: true } } },
  });
  const longTitle = "窄屏上也需要完整换行的文章标题".repeat(3);
  const longBody = [
    "## 第一部分",
    "",
    "### 嵌套章节",
    "",
    "## 第二部分",
    "",
    "```ts",
    `const longLine = "${"mobile-reading ".repeat(24)}";`,
    "```",
  ].join("\n");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await prisma.article.create({
    data: {
      id: longArticleId,
      slug: longArticleId,
      title: longTitle,
      excerpt: "窄屏长文阅读验收。",
      bodyLanguage: "zh",
      body: longBody,
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-14T00:00:00.000Z"),
    },
  });
  for (const article of originalTags) {
    if (!article.tags.some((tag) => tag.id === tagId)) {
      await prisma.article.update({ where: { id: article.id }, data: { tags: { connect: { id: tagId } } } });
    }
  }

  try {
    await page.goto(`${origin}/zh/articles?q=${encodeURIComponent("文章")}&tag=${tagId}`);
    await page.waitForFunction(() => document.querySelectorAll(".article-card__title").length === 6);
    await page.getByRole("link", { name: "加载更多文章" }).click();
    await page.waitForURL((url) => url.searchParams.get("limit") === "12");
    await page.waitForFunction(() => document.querySelectorAll(".article-card__title").length === 8);

    await page.locator(".article-card__title").last().focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname.endsWith(`/articles/${articleId}`));

    const returnUrl = new URL(await page.locator(".article-reading__back").getAttribute("href"), origin);
    assert.equal(returnUrl.pathname, "/zh/articles");
    assert.equal(returnUrl.searchParams.get("q"), "文章");
    assert.equal(returnUrl.searchParams.get("tag"), tagId);
    assert.equal(returnUrl.searchParams.get("limit"), "12");

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.waitForURL((url) => url.pathname === `/en/articles/${articleId}`);
    await page.waitForFunction(() => document.documentElement.lang === "en");
    const englishReturnUrl = new URL(await page.getByRole("link", { name: "Back to articles", exact: true }).getAttribute("href"), origin);
    assert.equal(englishReturnUrl.searchParams.get("q"), "文章");
    assert.equal(englishReturnUrl.searchParams.get("tag"), tagId);
    assert.equal(englishReturnUrl.searchParams.get("limit"), "12");
    await page.getByRole("button", { name: "中", exact: true }).click();
    await page.waitForURL((url) => url.pathname === `/zh/articles/${articleId}`);
    await page.waitForFunction(() => document.documentElement.lang === "zh");

    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/zh/articles" && url.searchParams.get("limit") === "12");
    await page.waitForFunction(
      (title) => document.activeElement?.textContent === title,
      "较早文章 C",
    );
    assert.equal(await page.locator(".article-card__title").count(), 8);

    await page.locator(".article-card__title").last().focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname.endsWith(`/articles/${articleId}`));
    await page.getByRole("link", { name: "返回文章列表", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/zh/articles" && url.searchParams.get("limit") === "12");
    await page.waitForFunction(
      (title) => document.activeElement?.textContent === title,
      "较早文章 C",
    );

    await page.goto(`${origin}/zh/articles/${longArticleId}`);
    await page.locator(".article-reading__contents").waitFor({ state: "visible" });
    assert.equal(await page.locator(".article-reading__contents a").count(), 3);

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    try {
      await mobilePage.goto(`${origin}/zh/articles/${longArticleId}`);
      for (const selector of [".article-reading__back", ".article-reading__end a"]) {
        const destination = new URL(await mobilePage.locator(selector).getAttribute("href"), origin);
        assert.equal(destination.pathname, "/zh/articles");
        assert.equal(destination.search, "");
      }
      const mobileContents = mobilePage.locator(".article-reading__contents-mobile");
      assert.equal(await mobileContents.isVisible(), true);
      assert.equal(await mobileContents.getAttribute("open"), null);
      assert.equal(
        await mobilePage.locator(".article-reading__opening h1").evaluate((element) => getComputedStyle(element).overflowWrap),
        "anywhere",
      );
      const codeBlock = mobilePage.locator(".article-reading__body pre");
      await codeBlock.waitFor({ state: "visible" });
      const codeMetrics = await codeBlock.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        whiteSpace: getComputedStyle(element).whiteSpace,
        overflowX: getComputedStyle(element).overflowX,
        textLength: element.textContent?.length,
      }));
      assert.ok(codeMetrics.scrollWidth > codeMetrics.clientWidth, JSON.stringify(codeMetrics));
      assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

      await mobileContents.locator("summary").click();
      const nestedHeading = mobilePage.locator(".article-reading__body h3");
      const headingId = await nestedHeading.getAttribute("id");
      await mobileContents.getByRole("link", { name: "嵌套章节" }).click();
      assert.equal(await mobilePage.evaluate(() => decodeURIComponent(location.hash.slice(1))), headingId);
    } finally {
      await mobileContext.close();
    }
  } finally {
    await context.close();
    await prisma.article.delete({ where: { id: longArticleId } });
    for (const { id, tags } of originalTags) {
      await prisma.article.update({ where: { id }, data: { tags: { set: tags.map(({ id: tag }) => ({ id: tag })) } } });
    }
  }
});

test("文章撤下后从阅读页返回列表结果顶部", { timeout: 45_000 }, async () => {
  const articleId = "http-article-old-c";
  const token = randomUUID();
  const ownerId = `article-return-owner-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id: ownerId,
      name: "文章返回验收站长",
      email: ownerEmail,
      emailVerified: true,
      sessions: {
        create: {
          id: `article-return-session-${randomUUID()}`,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });
  await stopServer();
  await startServer(true);
  const cookie = sessionCookie(token);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const original = await prisma.article.findUnique({ where: { id: articleId } });
  assert.ok(original);

  async function submitArticle(intent) {
    const editorResponse = await fetch(`${origin}/admin/articles/${articleId}`, { headers: { cookie } });
    assert.equal(editorResponse.status, 200);
    const editor = await editorResponse.text();
    const form = getProjectForm(editor, (candidate) => candidate.includes(`value="${intent}"`));
    const response = await submitProjectAction(`/admin/articles/${articleId}`, form, {
      intent,
      title: original.title,
      excerpt: original.excerpt,
      bodyLanguage: original.bodyLanguage,
      body: original.body,
      slug: original.slug,
      tagIds: "",
    }, cookie);
    await response.arrayBuffer();
    assert.ok(response.status < 400, `文章${intent}失败：${response.status}`);
  }

  try {
    await page.goto(`${origin}/zh/articles?q=${encodeURIComponent("文章")}`);
    await page.waitForFunction(() => document.querySelectorAll(".article-card__title").length === 6);
    await page.getByRole("link", { name: "加载更多文章" }).click();
    await page.waitForURL((url) => url.searchParams.get("limit") === "12");
    await page.waitForFunction(() => document.querySelectorAll(".article-card__title").length === 8);
    await page.locator(".article-card__title").last().focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname.endsWith(`/articles/${articleId}`));

    await submitArticle("withdraw");
    await page.evaluate(() => window.sessionStorage.clear());
    await page.locator(".article-reading__back").click();
    await page.waitForURL((url) => url.pathname === "/zh/articles" && url.searchParams.get("limit") === "12");
    await page.waitForFunction(() => document.querySelectorAll(".article-card__title").length === 7);
    assert.equal(await page.getByRole("link", { name: "较早文章 C" }).count(), 0);
    await page.waitForFunction(() => {
      const grid = document.querySelector(".articles-index__grid");
      const top = grid?.getBoundingClientRect().top;
      return typeof top === "number" && top >= -1 && top < 120;
    });
    const gridTop = await page.locator(".articles-index__grid").evaluate((element) => element.getBoundingClientRect().top);
    assert.ok(gridTop >= -1 && gridTop < 120, `列表应回到结果顶部，实际 top=${gridTop}`);
  } finally {
    await context.close();
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (article?.status === "WITHDRAWN") await submitArticle("publish");
    await prisma.session.deleteMany({ where: { userId: ownerId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await stopServer();
    await startServer();
  }
});

test("滚动到文章列表末尾时自动加载下一批", { timeout: 20_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh/articles`);
    const cards = page.locator(".articles-index__grid > li");
    await page.waitForFunction(() => document.querySelectorAll(".articles-index__grid > li").length === 6);
    const loadMore = page.getByRole("link", { name: "加载更多文章" });
    await loadMore.waitFor({ state: "visible" });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelectorAll(".articles-index__grid > li").length === 8, null, { timeout: 8_000 });
    assert.equal(await cards.count(), 8);
  } finally {
    await context.close();
  }
});

test("站长可给文章关联和移除标签，公开主题列表即时更新", { timeout: 45_000 }, async () => {
  const ownerId = `tag-article-owner-${randomUUID()}`;
  const token = randomUUID();
  await prisma.user.create({
    data: {
      id: ownerId,
      name: "文章标签验收站长",
      email: ownerEmail,
      emailVerified: true,
      sessions: {
        create: {
          id: `tag-article-session-${randomUUID()}`,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });

  try {
    await stopServer();
    await startServer(true);
    const cookie = sessionCookie(token);
    const editorResponse = await fetch(`${origin}/admin/articles/new`, { headers: { cookie } });
    const editor = await editorResponse.text();
    assert.equal(editorResponse.status, 200);
    assert.match(editor, /name="tagIds"/);
    assert.match(editor, /AI/);

    const newArticleForm = getProjectForm(editor, (form) => form.includes('class="article-editor"'));
    const publishResponse = await submitProjectAction("/admin/articles/new", newArticleForm, {
      intent: "publish",
      title: "站长标签文章",
      excerpt: "通过后台关联主题标签。",
      bodyLanguage: "zh",
      body: "## 标签正文\n\n隔离数据库验收。",
      slug: "owner-tagged-article",
      tagIds: "http-tag-ai",
    }, cookie);
    assert.ok(publishResponse.status < 400, `发布带标签文章失败：${publishResponse.status}`);
    await publishResponse.arrayBuffer();

    let article = await prisma.article.findUnique({ where: { slug: "owner-tagged-article" }, include: { tags: true } });
    assert.deepEqual(article?.tags.map((tag) => tag.name), ["AI"]);
    let topicList = await (await fetch(`${origin}/zh/articles?tag=http-tag-ai`)).text();
    assert.match(topicList, /站长标签文章/);

    const editResponse = await fetch(`${origin}/admin/articles/${article?.id}`, { headers: { cookie } });
    const editPage = await editResponse.text();
    assert.equal(editResponse.status, 200);
    const editForm = getProjectForm(editPage, (form) => form.includes('class="article-editor"'));
    const saveResponse = await submitProjectAction(`/admin/articles/${article?.id}`, editForm, {
      intent: "save",
      title: "站长标签文章",
      excerpt: "通过后台关联主题标签。",
      bodyLanguage: "zh",
      body: "## 标签正文\n\n隔离数据库验收。",
      slug: "owner-tagged-article",
    }, cookie);
    assert.ok(saveResponse.status < 400, `移除文章标签失败：${saveResponse.status}`);
    await saveResponse.arrayBuffer();

    article = await prisma.article.findUnique({ where: { slug: "owner-tagged-article" }, include: { tags: true } });
    assert.equal(article?.status, "PUBLISHED");
    assert.equal(article?.tags.length, 0);
    topicList = await (await fetch(`${origin}/zh/articles?tag=http-tag-ai`)).text();
    assert.doesNotMatch(topicList, /站长标签文章/);
    const allArticles = await (await fetch(`${origin}/zh/articles`)).text();
    assert.match(allArticles, /站长标签文章/);
  } finally {
    await stopServer();
    await prisma.user.delete({ where: { id: ownerId } });
    await startServer(false);
  }
});

test("站长可新增、改名、移除标签，未授权请求不能修改", { timeout: 45_000 }, async () => {
  const ownerId = `tag-owner-${randomUUID()}`;
  const ownerToken = randomUUID();
  const visitorId = `tag-visitor-${randomUUID()}`;
  const visitorToken = randomUUID();
  await prisma.user.create({
    data: {
      id: ownerId,
      name: "标签验收站长",
      email: ownerEmail,
      emailVerified: true,
      sessions: {
        create: {
          id: `tag-session-${randomUUID()}`,
          token: ownerToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      id: visitorId,
      name: "标签验收访客",
      email: "tag-visitor@example.test",
      emailVerified: true,
      sessions: {
        create: {
          id: `tag-session-${randomUUID()}`,
          token: visitorToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });

  try {
    await stopServer();
    await startServer(true);
    const ownerCookie = sessionCookie(ownerToken);
    const visitorCookie = sessionCookie(visitorToken);
    const initialTagCount = await prisma.tag.count();
    for (const cookie of [undefined, visitorCookie]) {
      const response = await fetch(`${origin}/admin/articles/tags`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
      });
      assert.ok([303, 307, 404].includes(response.status), `未授权读取后台标签应被拒绝，收到 ${response.status}`);
    }

    const pageResponse = await fetch(`${origin}/admin/articles/tags`, { headers: { cookie: ownerCookie } });
    const pageHtml = await pageResponse.text();
    assert.equal(pageResponse.status, 200);
    assert.match(pageHtml, /标签管理/);
    const createForm = getProjectForm(pageHtml, (form) => form.includes('name="intent" value="create"'));
    for (const cookie of [undefined, visitorCookie]) {
      const response = await submitProjectAction("/admin/articles/tags", createForm, {
        name: `未授权标签-${cookie ? "visitor" : "anonymous"}`,
      }, cookie);
      assert.notEqual(response.status, 200);
      await response.arrayBuffer();
      assert.equal(await prisma.tag.count(), initialTagCount);
    }

    const createResponse = await submitProjectAction("/admin/articles/tags", createForm, { name: "临时主题" }, ownerCookie);
    assert.ok(createResponse.status < 400, `新增标签失败：${createResponse.status}`);
    await createResponse.arrayBuffer();
    const createdTag = await prisma.tag.findUnique({ where: { name: "临时主题" } });
    assert.ok(createdTag);

    const afterCreate = await (await fetch(`${origin}/admin/articles/tags`, { headers: { cookie: ownerCookie } })).text();
    const renameForm = getProjectForm(afterCreate, (form) =>
      form.includes('name="intent" value="rename"') && form.includes(`name="id" value="${createdTag.id}"`),
    );
    const renameResponse = await submitProjectAction("/admin/articles/tags", renameForm, { name: "工程实践" }, ownerCookie);
    assert.ok(renameResponse.status < 400, `改名标签失败：${renameResponse.status}`);
    await renameResponse.arrayBuffer();
    assert.ok(await prisma.tag.findUnique({ where: { name: "工程实践" } }));

    const afterRename = await (await fetch(`${origin}/admin/articles/tags`, { headers: { cookie: ownerCookie } })).text();
    const renameAiForm = getProjectForm(afterRename, (form) =>
      form.includes('name="intent" value="rename"') && form.includes('name="id" value="http-tag-ai"'),
    );
    const renameAi = await submitProjectAction("/admin/articles/tags", renameAiForm, { name: "人工智能" }, ownerCookie);
    assert.ok(renameAi.status < 400, `改名文章标签失败：${renameAi.status}`);
    await renameAi.arrayBuffer();
    assert.match(await (await fetch(`${origin}/zh/articles/http-article-ai`)).text(), /人工智能/);

    const afterAiRename = await (await fetch(`${origin}/admin/articles/tags`, { headers: { cookie: ownerCookie } })).text();
    const removeAiForm = getProjectForm(afterAiRename, (form) =>
      form.includes('name="intent" value="delete"') && form.includes('name="id" value="http-tag-ai"'),
    );
    const removeResponse = await submitProjectAction("/admin/articles/tags", removeAiForm, {}, ownerCookie);
    assert.ok(removeResponse.status < 400, `移除标签失败：${removeResponse.status}`);
    await removeResponse.arrayBuffer();
    const remainingArticle = await prisma.article.findUnique({ where: { id: "http-article-ai" }, include: { tags: true } });
    assert.equal(remainingArticle?.status, "PUBLISHED");
    assert.equal(remainingArticle?.tags.length, 0);
    const publicList = await (await fetch(`${origin}/zh/articles`)).text();
    assert.match(publicList, /AI 技术文章/);
    assert.doesNotMatch(publicList, /人工智能/);
    const staleTag = await (await fetch(`${origin}/zh/articles?tag=http-tag-ai`)).text();
    assert.match(staleTag, /所选标签已失效/);

    const afterRemove = await (await fetch(`${origin}/admin/articles/tags`, { headers: { cookie: ownerCookie } })).text();
    const removeCreatedForm = getProjectForm(afterRemove, (form) =>
      form.includes('name="intent" value="delete"') && form.includes(`name="id" value="${createdTag.id}"`),
    );
    const removeCreated = await submitProjectAction("/admin/articles/tags", removeCreatedForm, {}, ownerCookie);
    assert.ok(removeCreated.status < 400, `移除新标签失败：${removeCreated.status}`);
    await removeCreated.arrayBuffer();
    assert.equal(await prisma.tag.findUnique({ where: { id: createdTag.id } }), null);
  } finally {
    await stopServer();
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, visitorId] } } });
    await startServer(false);
  }
});

test("首页未配置介绍、联系入口和社交链接时省略相应内容", async () => {
  for (const locale of ["zh", "en"]) {
    const response = await fetch(`${origin}/${locale}`);
    const html = await response.text();
    const renderedHtml = html.slice(0, html.indexOf("<script id=\"_R_\">"));

    assert.equal(response.status, 200);
    assert.doesNotMatch(renderedHtml, /联系我|Contact me/);
    assert.doesNotMatch(renderedHtml, /href="mailto:/);
    assert.doesNotMatch(renderedHtml, /public-footer__links/);
  }
});

test("双语首页返回对应界面语言和定稿工作流程文案", async () => {
  for (const locale of ["zh", "en"]) {
    const response = await fetch(`${origin}/${locale}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
    assert.match(html, /让想法，一步步落地。/);
    assert.match(html, /UI 与交互设计/);
  }
});

test("站点设置在中英文首页共用原文并按序展示", async () => {
  await prisma.siteSetting.create({
    data: {
      id: 1,
      heroIntroduction: "  为真实任务构建清晰、可靠的产品。\n保留第二行。  ",
      contactUrl: "mailto:hello@example.com",
      socialLinks: [
        { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
        { name: "个人主页", url: "https://example.com/lawson", icon: "link" },
      ],
    },
  });
  await stopServer();
  await startServer();

  for (const locale of ["zh", "en"]) {
    const response = await fetch(`${origin}/${locale}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /为真实任务构建清晰、可靠的产品。/);
    assert.match(html, /保留第二行。/);
    assert.match(html, /href="mailto:hello@example\.com"/);
    assert.match(html, /GitHub/);
    assert.match(html, /个人主页/);
    assert.ok(html.indexOf("GitHub") < html.indexOf("个人主页"));
  }
});

test("首页滚动提示保留英文且不响应点击或进入焦点顺序", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh`);
    const prompt = page.locator(".home-hero__explore");
    assert.equal((await prompt.locator(".home-hero__explore-label").innerText()).trim(), "Explore Below ↓");
    assert.equal((await prompt.locator(".home-hero__explore-description").innerText()).trim(), "向下浏览精选文章");
    assert.equal(await prompt.evaluate((element) => element.tagName), "P");
    assert.equal(await prompt.getAttribute("aria-hidden"), "true");
    assert.equal(await prompt.getAttribute("tabindex"), null);
    assert.equal(await prompt.getAttribute("data-scroll-target"), "#featured-articles");
    assert.equal(await prompt.locator("a, button, [tabindex]").count(), 0);

    await page.goto(`${origin}/en`);
    assert.equal(
      (await page.locator(".home-hero__explore-description").innerText()).trim(),
      "Scroll to explore featured articles",
    );
  } finally {
    await context.close();
  }
});

test("首页文案和入口随滚动淡出，手机页面仍可正常滚动", { timeout: 60_000 }, async () => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${origin}/zh`);
    await desktopPage.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    await desktopPage.evaluate(() => window.scrollTo({ top: innerHeight * 0.75, behavior: "instant" }));
    await desktopPage.waitForFunction(
      () => Number(getComputedStyle(document.querySelector(".home-hero__content")).opacity) < 0.5,
      null,
      { timeout: 5_000 },
    );
    assert.ok(Number(await desktopPage.locator(".home-hero__content").evaluate((element) => getComputedStyle(element).opacity)) < 0.5);
  } finally {
    await desktop.close();
  }

  // 释放桌面点云上下文并等移动端首帧就绪后再发触摸手势，避免软渲染争抢吞掉滚动。
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${origin}/zh`);
    await mobilePage.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    const touch = await mobilePage.context().newCDPSession(mobilePage);
    await mobilePage.evaluate(() => {
      window.__touchEventCounts = { touchstart: 0, touchmove: 0, touchend: 0 };
      for (const name of Object.keys(window.__touchEventCounts)) {
        window.addEventListener(name, () => window.__touchEventCounts[name] += 1, { passive: true });
      }
    });
    const touchPoints = (y) => [{ id: 1, x: 24, y, radiusX: 1, radiusY: 1, force: 1 }];
    // 注入真实 touchStart/touchMove/touchEnd，并由浏览器默认行为滚动页面。
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints(760) });
    for (const y of [680, 600, 520, 440]) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPoints(y) });
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const touchEvents = await mobilePage.evaluate(() => window.__touchEventCounts);
    assert.ok(touchEvents.touchstart > 0, "触摸滚动应分发 touchstart");
    assert.ok(touchEvents.touchmove > 0, "触摸滚动应分发 touchmove");
    assert.ok(touchEvents.touchend > 0, "触摸滚动应分发 touchend");
    await mobilePage.waitForFunction(() => scrollY >= 150, null, { timeout: 15_000 });
    assert.ok(Number(await mobilePage.locator(".home-hero__content").evaluate((element) => getComputedStyle(element).opacity)) < 1);
    assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await mobilePage.evaluate(() => scrollY > 0));
    await touch.detach();
  } finally {
    await mobile.close();
  }
});

// CI 无 GPU 软渲染单帧与三次截图耗时较长，预留足够超时避免级联污染后续用例。
test("桌面角色随指针移动并在指针离开后回到自然姿态", { timeout: 90_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    const canvas = page.locator(".home-character__canvas canvas");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(800);
    const natural = await canvas.screenshot();

    await page.mouse.move(850, 220);
    await page.waitForTimeout(350);
    const following = await canvas.screenshot();
    assert.ok(!following.equals(natural), "指针移动应改变角色绘制结果");

    await page.mouse.move(0, 0);
    await page.waitForTimeout(1_200);
    const returned = await canvas.screenshot();
    assert.ok(!returned.equals(following), "指针离开后角色应开始回到自然姿态");
  } finally {
    await context.close();
  }
});

test("桌面角色只在进入流程区后切换对应阶段姿态", { timeout: 90_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1_000);
    const processTop = await page.locator(".home-process").evaluate(
      (element) => element.getBoundingClientRect().top + scrollY,
    );
    const canvas = page.locator(".home-character__canvas canvas");
    const changedPixels = (first, second) => page.evaluate(async ([a, b]) => {
      const decode = async (source) => {
        const response = await fetch(`data:image/png;base64,${source}`);
        return createImageBitmap(await response.blob());
      };
      const [left, right] = await Promise.all([decode(a), decode(b)]);
      const image = document.createElement("canvas");
      image.width = left.width;
      image.height = left.height;
      const context = image.getContext("2d", { willReadFrequently: true });
      context.drawImage(left, 0, 0);
      const firstPixels = context.getImageData(0, 0, image.width, image.height).data;
      context.clearRect(0, 0, image.width, image.height);
      context.drawImage(right, 0, 0);
      const secondPixels = context.getImageData(0, 0, image.width, image.height).data;
      let changed = 0;
      for (let index = 0; index < firstPixels.length; index += 4) {
        if (Math.abs(firstPixels[index] - secondPixels[index]) +
            Math.abs(firstPixels[index + 1] - secondPixels[index + 1]) +
            Math.abs(firstPixels[index + 2] - secondPixels[index + 2]) > 60) changed++;
      }
      return changed;
    }, [first.toString("base64"), second.toString("base64")]);

    await page.evaluate(() => {
      document.querySelector(".home-process")?.removeAttribute("data-home-motion");
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(1_000);
    const heroPose = await canvas.screenshot();

    await page.evaluate(() => {
      document.querySelector(".home-process")?.setAttribute("data-home-motion", "process");
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(1_000);
    const beforeProcess = await canvas.screenshot();
    const earlyMovement = await changedPixels(heroPose, beforeProcess);
    assert.ok(earlyMovement < 10_000, `流程区尚未进入视口时姿态不应切换，像素变化 ${earlyMovement} (top=${processTop})`);

    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), processTop + 300);
    await page.waitForTimeout(1_000);
    const inProcess = await canvas.screenshot();
    const stageMovement = await changedPixels(heroPose, inProcess);
    assert.ok(stageMovement > 10_000, `进入流程区后角色应切换到该阶段姿态，像素变化 ${stageMovement}`);
  } finally {
    await context.close();
  }
});

test("不支持的界面语言返回 HTTP 404", async () => {
  const response = await fetch(`${origin}/fr`, { redirect: "manual" });
  assert.equal(response.status, 404);
});

test("公开首页提供可关闭的可选登录提示", async () => {
  const response = await fetch(`${origin}/zh`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /继续匿名浏览/);
  assert.match(html, /使用 Google 登录/);
  assert.match(html, /关闭登录提示/);
});

test("未配置 Google OAuth 时登录状态按匿名返回", async () => {
  const response = await fetch(`${origin}/api/auth/get-session`);

  assert.equal(response.status, 200);
  assert.equal(await response.json(), null);
});

test("未配置 Google OAuth 时登录失败不会中断匿名浏览", async () => {
  const response = await fetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/zh` }),
  });

  assert.equal(response.status, 503);
  const home = await fetch(`${origin}/zh`);
  assert.equal(home.status, 200);
});

test("未登录访问后台会被引导回公开登录入口", async () => {
  const response = await fetch(`${origin}/admin`, { redirect: "manual" });
  const destination = new URL(response.headers.get("location"), origin);

  assert.equal(response.status, 307);
  assert.equal(destination.pathname, "/zh");
  assert.equal(destination.searchParams.get("next"), "/admin");
});

test("作品列表区分站内详情与外部页面，并按首次发布时间倒序展示", async () => {
  const response = await fetch(`${origin}/zh/projects`);
  const html = await response.text();

  assert.equal(response.status, 200, `作品列表失败：${response.status}\n${html.slice(0, 1000)}\n${serverOutput.slice(-4000)}`);
  assert.match(html, /href="\/zh\/projects\/http-internal"/);
  assert.match(html, /href="https:\/\/example\.com"[^>]*target="_blank"/);
  assert.match(html, /查看项目详情/);
  assert.match(html, /外部网站/);
  assert.match(html, /个人网站/);
  assert.ok(html.indexOf("开源工具") < html.indexOf("测试内链作品"));
  assert.match(html, /<nav\b[\s\S]*?href="\/zh\/projects"/);

  const englishResponse = await fetch(`${origin}/en/projects`);
  const englishHtml = await englishResponse.text();
  assert.equal(englishResponse.status, 200);
  assert.match(englishHtml, /<h1[^>]*>Works<\/h1>/);
  assert.match(englishHtml, /View project details/);
  assert.match(englishHtml, /External site \(opens in a new tab\)/);
});

test("站内作品详情呈现 Markdown 和已配置的外部访问入口", async () => {
  const response = await fetch(`${origin}/zh/projects/http-internal`);
  const html = await response.text();

  assert.equal(response.status, 200, `站内详情失败：${response.status}\n${html.slice(0, 1000)}\n${serverOutput.slice(-4000)}`);
  assert.match(html, /<h1[^>]*>测试内链作品<\/h1>/);
  assert.match(html, /<h2[^>]*>项目背景<\/h2>/);
  assert.match(html, /这是通过 HTTP 验证的项目正文。/);
  assert.match(html, /href="https:\/\/trace\.example"[^>]*target="_blank"/);

  const englishResponse = await fetch(`${origin}/en/projects/http-internal`);
  const englishHtml = await englishResponse.text();
  assert.equal(englishResponse.status, 200);
  assert.match(englishHtml, /<html[^>]*lang="en"/);
  assert.match(englishHtml, /Visit project/);
  assert.match(englishHtml, /class="project-detail__body" lang="zh"/);
});

test("无效、草稿、撤下和外链作品的站内详情均返回 HTTP 404", async () => {
  for (const slug of ["missing-project", "side-project", "http-withdrawn", "personal-website"]) {
    const response = await fetch(`${origin}/zh/projects/${slug}`);
    assert.equal(response.status, 404, `${slug} 应返回 HTTP 404；收到 ${response.status}\n${serverOutput.slice(-4000)}`);
  }
});

test("角色首帧前保留静态图与首页入口，首帧渲染后再显示点云", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let continueAsset;
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.route("**/models/custom/person.bin", async (route) => {
    await new Promise((resolve) => (continueAsset = resolve));
    await route.continue();
  });
  try {
    const requested = page.waitForRequest(
      (request) => request.url().endsWith("/models/custom/person.bin"),
      { timeout: 5_000 },
    );
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "loading",
      null,
      { timeout: 5_000 },
    );
    try {
      await requested;
    } catch (error) {
      const stage = await page.locator(".home-hero__character").getAttribute("data-character-stage");
      throw new Error(`${error.message}\n阶段：${stage}\n浏览器错误：\n${browserErrors.join("\n")}`);
    }
    assert.equal(await page.locator(".home-hero__character img").isVisible(), true);
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);

    continueAsset();
    try {
      await page.waitForFunction(
        () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
        null,
        { timeout: 15_000 },
      );
    } catch (error) {
      throw new Error(`${error.message}\n浏览器错误：\n${browserErrors.join("\n")}`);
    }
    assert.equal(await page.locator(".home-hero__character img").evaluate((image) => getComputedStyle(image).opacity), "0");
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
  } finally {
    continueAsset?.();
    await context.close();
  }
});

test("减少动态效果时跳过点云，设置变化时恢复静态图并按偏好重启", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  let pointRequests = 0;
  await page.route("**/models/custom/person.bin", (route) => {
    pointRequests += 1;
    return route.continue();
  });

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForTimeout(250);
    assert.equal(await page.locator(".home-hero__character").getAttribute("data-character-stage"), "static-fallback");
    assert.equal(await page.locator(".home-character__canvas").count(), 0);
    assert.equal(pointRequests, 0);
    assert.equal(await page.locator(".home-hero__character img").isVisible(), true);
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    assert.ok(pointRequests > 0);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "static-fallback",
      null,
      { timeout: 5_000 },
    );
    assert.equal(await page.locator(".home-character__canvas").count(), 0);
    assert.equal(await page.locator(".home-hero__character img").evaluate((image) => getComputedStyle(image).opacity), "1");
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
  } finally {
    await context.close();
  }
});

test("手机启用减少动态效果时使用手机静态图且首屏入口可见", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForTimeout(250);
    const source = await page.locator(".home-hero__character img").evaluate((image) => image.currentSrc);
    assert.equal(new URL(source).pathname, "/images/character/static-mobile.webp");
    assert.equal(await page.locator(".home-hero__character img").isVisible(), true);
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
    assert.equal(await page.locator(".home-hero__secondary").isVisible(), true);
    assert.equal(await page.locator(".home-character__canvas").count(), 0);
  } finally {
    await context.close();
  }
});

test("点云资源失败时保留首页入口，刷新后重新请求", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let pointRequests = 0;
  await page.route("**/models/custom/person.bin", (route) => {
    pointRequests += 1;
    if (pointRequests === 1) return route.fulfill({ status: 500, body: "unavailable" });
    return route.continue();
  });

  try {
    const failedRequest = page.waitForRequest(
      (request) => request.url().endsWith("/models/custom/person.bin"),
      { timeout: 5_000 },
    );
    await page.goto(`${origin}/zh`);
    await failedRequest;
    await page.waitForFunction(() =>
      document.querySelector(".home-hero__character")?.dataset.characterStage === "static-fallback" &&
        !document.querySelector(".home-character__canvas"),
      null,
      { timeout: 10_000 },
    );
    assert.equal(pointRequests, 1);
    assert.equal(await page.locator(".home-hero__character img").evaluate((image) => getComputedStyle(image).opacity), "1");
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);

    await page.reload();
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    assert.equal(pointRequests, 2);
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
  } finally {
    await context.close();
  }
});

test("八秒仍未绘制首帧时保持静态图，刷新后可以重试", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let pointRequests = 0;
  let releaseFirstRequest;
  await page.route("**/models/custom/person.bin", async (route) => {
    pointRequests += 1;
    if (pointRequests === 1) {
      await new Promise((resolve) => (releaseFirstRequest = resolve));
      try {
        await route.abort("timedout");
      } catch {}
      return;
    }
    return route.continue();
  });

  try {
    const requested = page.waitForRequest(
      (request) => request.url().endsWith("/models/custom/person.bin"),
      { timeout: 5_000 },
    );
    await page.goto(`${origin}/zh`);
    await requested;
    try {
      await page.waitForFunction(
        () => document.querySelector(".home-hero__character")?.dataset.characterStage === "static-fallback" &&
          !document.querySelector(".home-character__canvas"),
        null,
        { timeout: 10_000 },
      );
    } catch (error) {
      const details = await page.evaluate(() => ({
        stage: document.querySelector(".home-hero__character")?.getAttribute("data-character-stage"),
        canvas: document.querySelectorAll(".home-character__canvas").length,
        visibility: document.visibilityState,
      }));
      throw new Error(`${error.message}\n${JSON.stringify(details)}`);
    }
    assert.equal(pointRequests, 1);
    assert.equal(await page.locator(".home-hero__character img").evaluate((image) => getComputedStyle(image).opacity), "1");
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);

    releaseFirstRequest?.();
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    assert.equal(pointRequests, 2);
  } finally {
    releaseFirstRequest?.();
    await context.close();
  }
});

test("浏览器不支持 WebGL 时保留静态角色图和首页入口", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "webglAttempts", { value: 0, writable: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") {
        window.webglAttempts += 1;
        return null;
      }
      return original.call(this, type, ...args);
    };
  });

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(() => window.webglAttempts > 0, null, { timeout: 5_000 });
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "static-fallback" &&
        !document.querySelector(".home-character__canvas"),
      null,
      { timeout: 5_000 },
    );
    assert.equal(await page.locator(".home-hero__character img").isVisible(), true);
    assert.equal(
      await page.getByRole("link", { name: "浏览文章", exact: true }).filter({ visible: true }).first().isVisible(),
      true,
    );
  } finally {
    await context.close();
  }
});

test("实际绘制出现错误时立即回到静态角色图", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "renderErrorAttempts", { value: 0, writable: true });
    const prototype = WebGL2RenderingContext.prototype;
    const original = prototype.drawElementsInstanced;
    prototype.drawElementsInstanced = function (...args) {
      if (window.renderErrorAttempts === 0) {
        window.renderErrorAttempts += 1;
        throw new Error("simulated drawing failure");
      }
      return original.apply(this, args);
    };
  });

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(() => window.renderErrorAttempts > 0, null, { timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "static-fallback" &&
        !document.querySelector(".home-character__canvas"),
      null,
      { timeout: 5_000 },
    );
    assert.equal(await page.locator(".home-hero__character img").isVisible(), true);
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
  } finally {
    await context.close();
  }
});

test("缺少浮点颜色缓冲扩展时仍绘制点云", { timeout: 45_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "floatExtensionQueries", { value: 0, writable: true });
    for (const Constructor of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!Constructor) continue;
      const original = Constructor.prototype.getExtension;
      Constructor.prototype.getExtension = function (name) {
        if (name === "EXT_color_buffer_float") {
          window.floatExtensionQueries += 1;
          return null;
        }
        return original.call(this, name);
      };
    }
  });

  try {
    await page.goto(`${origin}/zh`);
    await page.waitForFunction(
      () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
      null,
      { timeout: 15_000 },
    );
    assert.ok(await page.evaluate(() => window.floatExtensionQueries > 0));
    assert.equal(await page.locator(".home-hero__character img").evaluate((image) => getComputedStyle(image).opacity), "0");
  } finally {
    await context.close();
  }
});

test("弱设备降到 DPR 1，缺失设备指标不会判为弱设备", { timeout: 60_000 }, async () => {
  for (const metrics of [
    { hardwareConcurrency: 4, deviceMemory: 8, weak: true },
    { hardwareConcurrency: 8, deviceMemory: 4, weak: true },
    { hardwareConcurrency: undefined, deviceMemory: undefined, weak: false },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.addInitScript((device) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: device.hardwareConcurrency });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: device.deviceMemory });
    }, metrics);

    try {
      await page.goto(`${origin}/zh`);
      await page.waitForFunction(
        () => document.querySelector(".home-hero__character")?.dataset.characterStage === "rendered",
        null,
        { timeout: 15_000 },
      );
      const ratio = await page.locator(".home-character__canvas canvas").evaluate(
        (canvas) => canvas.width / canvas.getBoundingClientRect().width,
      );
      if (metrics.weak) {
        assert.ok(Math.abs(ratio - 1) < 0.02, `预期弱设备 DPR 为 1，实际为 ${ratio}`);
      } else {
        const expected = await page.evaluate(() => Math.min(2, matchMedia("(max-width: 767px), (pointer: coarse)").matches ? 1.5 : 2));
        assert.ok(Math.abs(ratio - expected) < 0.02, `缺失指标按普通设备处理，预期 ${expected}，实际 ${ratio}`);
      }
    } finally {
      await context.close();
    }
  }
});

test("站长可以保存站点设置；无效或失败时保留输入并即时更新首页", async () => {
  const userId = `owner-${randomUUID()}`;
  const token = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: "隔离测试站长",
      email: ownerEmail,
      emailVerified: true,
      sessions: {
        create: {
          id: `session-${randomUUID()}`,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });

  await stopServer();
  await startServer(true);
  const cookie = sessionCookie(token);
  const sessionResponse = await fetch(`${origin}/api/auth/get-session`, {
    headers: { cookie },
  });
  assert.equal(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).user.email, ownerEmail);

  const adminResponse = await fetch(`${origin}/admin`, {
    headers: { cookie },
  });
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /首页设置/);
  const actionForm = getActionForm(adminHtml);

  const articlePageResponse = await fetch(`${origin}/admin/articles/new`, { headers: { cookie } });
  const articlePageHtml = await articlePageResponse.text();
  const articleActionForm = getProjectForm(articlePageHtml, (form) => form.includes('class="article-editor"'));
  const projectsResponse = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  const projectsHtml = await projectsResponse.text();
  const projectActionForm = getProjectForm(projectsHtml, (form) =>
    form.includes('class="admin-project-form"') && form.includes('name="slug" value="side-project"'),
  );
  const projectId = projectActionForm.find(([name]) => name === "id")?.[1];
  assert.ok(projectId, "测试作品表单应包含作品 id");

  const visitorId = `visitor-${randomUUID()}`;
  const visitorToken = randomUUID();
  await prisma.user.create({
    data: {
      id: visitorId,
      name: "隔离测试访客",
      email: "visitor@example.test",
      emailVerified: true,
      sessions: {
        create: {
          id: `session-${randomUUID()}`,
          token: visitorToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    },
  });

  try {
    const initialSetting = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    const initialArticleCount = await prisma.article.count();
    const initialProject = await prisma.project.findUnique({ where: { id: projectId } });
    for (const [label, unauthorizedCookie] of [["匿名访客", undefined], ["非站长", sessionCookie(visitorToken)]]) {
      const settingsResult = await postSettings(actionForm({
        heroIntroduction: `未经授权的首页修改 ${label}`,
        contactUrl: "https://example.com/unauthorized",
        socialLinks: [],
      }), unauthorizedCookie);
      assert.ok([303, 307, 404].includes(settingsResult.status), `${label} 修改首页设置应被拒绝，收到 ${settingsResult.status}`);
      await settingsResult.arrayBuffer();
      assert.deepEqual(await prisma.siteSetting.findUnique({ where: { id: 1 } }), initialSetting);

      const articleResult = await submitProjectAction("/admin/articles/new", articleActionForm, {
        intent: "save",
        title: `未经授权的文章 ${label}`,
        excerpt: "这条提交内容完整且可保存。",
        bodyLanguage: "zh",
        body: "有效正文。",
        slug: `unauthorized-${label === "匿名访客" ? "anonymous" : "visitor"}`,
      }, unauthorizedCookie);
      assert.ok([303, 307, 404].includes(articleResult.status), `${label} 新建文章应被拒绝，收到 ${articleResult.status}`);
      await articleResult.arrayBuffer();
      assert.equal(await prisma.article.count(), initialArticleCount);

      const projectResult = await submitProjectAction("/admin/projects", projectActionForm, {
        id: projectId,
        slug: "side-project",
        name: `未经授权的作品修改 ${label}`,
        description: "有效的作品简介。",
        type: "实验项目",
        cardTarget: "INTERNAL",
        url: "",
        coverImage: "",
        body: "## 正文\n\n有效作品正文。",
        contentLanguage: "zh",
      }, unauthorizedCookie);
      assert.ok([303, 307, 404].includes(projectResult.status), `${label} 修改作品应被拒绝，收到 ${projectResult.status}`);
      await projectResult.arrayBuffer();
      assert.deepEqual(await prisma.project.findUnique({ where: { id: projectId } }), initialProject);
    }
  } finally {
    await prisma.user.delete({ where: { id: visitorId } });
  }

  const articleContext = await browser.newContext();
  try {
    await articleContext.addCookies([{
      name: "better-auth.session_token",
      value: cookie.slice("better-auth.session_token=".length),
      url: origin,
    }]);
    const articlePage = await articleContext.newPage();
    await articlePage.goto(`${origin}/admin/articles/new`);
    await articlePage.locator("#article-slug").fill("freshly-entered-slug");
    const dialogEvent = articlePage.waitForEvent("dialog");
    const publishClick = articlePage.getByRole("button", { name: "发布文章" }).click();
    const dialog = await dialogEvent;
    const confirmation = dialog.message();
    await dialog.dismiss();
    await publishClick;
    assert.equal(confirmation, "确认首次发布到 /articles/freshly-entered-slug 吗？");
  } finally {
    await articleContext.close();
  }

  const invalidResponse = await postSettings(
    actionForm({
      heroIntroduction: "无效保存时仍保留这段输入",
      contactUrl: "http://example.com/contact",
      socialLinks: [
        { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
      ],
    }),
    cookie,
  );
  const invalidBody = await invalidResponse.text();
  assert.equal(invalidResponse.status, 200, invalidBody.slice(0, 1_500));
  assert.match(invalidBody, /请输入 mailto: 邮箱地址或 HTTPS 地址/);
  assert.match(invalidBody, /无效保存时仍保留这段输入/);
  assert.equal(
    (await prisma.siteSetting.findUnique({ where: { id: 1 } }))?.heroIntroduction,
    "  为真实任务构建清晰、可靠的产品。\n保留第二行。  ",
  );

  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION reject_site_setting_write() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'isolated test save failure';
    END;
    $$
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER reject_site_setting_write
    BEFORE INSERT OR UPDATE ON "SiteSetting"
    FOR EACH ROW EXECUTE FUNCTION reject_site_setting_write()
  `);
  const failedSaveResponse = await postSettings(
    actionForm({
      heroIntroduction: "数据库失败时仍保留这段输入",
      contactUrl: "https://example.com/contact",
      socialLinks: [],
    }),
    cookie,
  );
  const failedSaveBody = await failedSaveResponse.text();
  assert.equal(failedSaveResponse.status, 200);
  assert.match(failedSaveBody, /保存失败，请稍后重试/);
  assert.match(failedSaveBody, /数据库失败时仍保留这段输入/);
  assert.equal(
    (await prisma.siteSetting.findUnique({ where: { id: 1 } }))?.heroIntroduction,
    "  为真实任务构建清晰、可靠的产品。\n保留第二行。  ",
  );
  await prisma.$executeRawUnsafe(`DROP TRIGGER reject_site_setting_write ON "SiteSetting"`);
  await prisma.$executeRawUnsafe("DROP FUNCTION reject_site_setting_write()");

  const savedResponse = await postSettings(
    actionForm({
      heroIntroduction: "保存后立即公开的介绍",
      contactUrl: "https://example.com/contact",
      socialLinks: [
        { name: "个人主页", url: "https://example.com/lawson", icon: "link" },
        { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
      ],
    }),
    cookie,
  );
  const savedBody = await savedResponse.text();
  assert.equal(savedResponse.status, 200);
  assert.match(savedBody, /已保存，首页内容已更新/);

  const updated = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  assert.equal(updated?.heroIntroduction, "保存后立即公开的介绍");
  assert.equal(updated?.contactUrl, "https://example.com/contact");
  assert.deepEqual(updated?.socialLinks, [
    { name: "个人主页", url: "https://example.com/lawson", icon: "link" },
    { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
  ]);

  const publicResponse = await fetch(`${origin}/zh`);
  const publicHtml = await publicResponse.text();
  assert.equal(publicResponse.status, 200);
  assert.match(publicHtml, /保存后立即公开的介绍/);
  assert.match(publicHtml, /href="https:\/\/example\.com\/contact"/);
});

test("站长可保存不完整草稿、确认发布、撤下并按原地址重新发布", async (context) => {
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  const createdOwner = !owner;
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        id: `project-owner-${randomUUID()}`,
        name: "作品测试站长",
        email: ownerEmail,
        emailVerified: true,
      },
    });
  }
  const token = randomUUID();
  await prisma.session.create({
    data: {
      id: `project-session-${randomUUID()}`,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      userId: owner.id,
    },
  });
  context.after(async () => {
    await prisma.session.delete({ where: { token } });
    if (createdOwner) await prisma.user.delete({ where: { id: owner.id } });
  });

  await stopServer();
  await startServer(true);
  const cookie = sessionCookie(token);
  const adminResponse = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /作品管理/);

  const newDraftForm = getProjectForm(adminHtml, (form) => form.includes('class="admin-project-form"'));
  const saveDraft = await submitProjectAction("/admin/projects", newDraftForm, {
    id: "",
    slug: "http-actions-draft",
    name: "HTTP 操作作品",
    description: "",
    type: "",
    cardTarget: "INTERNAL",
    url: "",
    coverImage: "",
    body: "",
    contentLanguage: "",
  }, cookie);
  assert.ok(saveDraft.status < 400, `保存草稿失败：${saveDraft.status} ${await saveDraft.text()}`);
  const draft = await prisma.project.findUnique({ where: { slug: "http-actions-draft" } });
  assert.ok(draft, "不完整作品应保存为草稿");
  assert.equal(draft.status, "DRAFT");

  const browserContext = await browser.newContext();
  context.after(() => browserContext.close());
  await browserContext.addCookies([{
    name: "better-auth.session_token",
    value: cookie.slice("better-auth.session_token=".length),
    url: origin,
  }]);
  const adminPage = await browserContext.newPage();
  await adminPage.goto(`${origin}/admin/projects`);
  let editorRow = adminPage.locator(".admin-project-row").filter({ hasText: draft.slug });
  await editorRow.locator("summary").click();
  await expectConfirmation(
    adminPage,
    editorRow.getByRole("button", { name: "确认地址并发布" }),
    "请确认作品地址为“http-actions-draft”。首次发布后地址和首次发布时间将固定。",
  );

  let response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  let html = await response.text();
  let publishForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-action"') &&
    form.includes(`name="id" value="${draft.id}"`) &&
    form.includes("确认地址并发布"),
  );
  const invalidPublish = await submitProjectAction("/admin/projects", publishForm, { id: draft.id }, cookie);
  assert.ok(invalidPublish.status < 400, `无效发布请求失败：${invalidPublish.status}`);
  await invalidPublish.arrayBuffer();
  let project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.status, "DRAFT", "缺少必填字段时不得发布");

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  const editForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-form"') && form.includes(`name="id" value="${draft.id}"`),
  );
  const saveCompleteDraft = await submitProjectAction("/admin/projects", editForm, {
    id: draft.id,
    slug: "http-actions-published",
    name: "HTTP 操作作品",
    description: "用于验证发布和撤下流程。",
    type: "实验项目",
    cardTarget: "INTERNAL",
    url: "https://trace.example/project",
    coverImage: "",
    body: "## 正文\n\n已完成发布所需内容。",
    contentLanguage: "zh",
  }, cookie);
  assert.ok(saveCompleteDraft.status < 400, `补齐草稿失败：${saveCompleteDraft.status}`);
  await saveCompleteDraft.arrayBuffer();

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  publishForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-action"') &&
    form.includes(`name="id" value="${draft.id}"`) &&
    form.includes("确认地址并发布"),
  );
  const publish = await submitProjectAction("/admin/projects", publishForm, { id: draft.id }, cookie);
  assert.ok(publish.status < 400, `发布失败：${publish.status}`);
  await publish.arrayBuffer();
  project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.status, "PUBLISHED");
  const firstPublishedAt = project.firstPublishedAt;
  assert.ok(firstPublishedAt instanceof Date);

  await adminPage.goto(`${origin}/admin/projects`);
  editorRow = adminPage.locator(".admin-project-row").filter({ hasText: "http-actions-published" });
  await editorRow.locator("summary").click();
  await expectConfirmation(
    adminPage,
    editorRow.getByRole("button", { name: "保存并更新公开内容" }),
    "保存后会立即更新公开作品。确认继续吗？",
  );
  await expectConfirmation(
    adminPage,
    editorRow.getByRole("button", { name: "撤下作品" }),
    "撤下后作品会立即从公开列表移除，站内地址将返回 404。确认撤下吗？",
  );

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  const invalidUpdateForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-form"') && form.includes(`name="id" value="${draft.id}"`),
  );
  const invalidUpdate = await submitProjectAction("/admin/projects", invalidUpdateForm, {
    id: draft.id,
    slug: "http-actions-published",
    name: "HTTP 操作作品",
    description: "",
    type: "实验项目",
    cardTarget: "INTERNAL",
    url: "https://trace.example/project",
    coverImage: "",
    body: "## 正文\n\n已完成发布所需内容。",
    contentLanguage: "zh",
  }, cookie);
  assert.ok(invalidUpdate.status < 400, `拒绝无效更新失败：${invalidUpdate.status}`);
  await invalidUpdate.arrayBuffer();
  project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.description, "用于验证发布和撤下流程。", "无效更新不应覆盖公开内容");

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  const withdrawForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-action"') &&
    form.includes(`name="id" value="${draft.id}"`) &&
    form.includes("撤下作品"),
  );
  const withdraw = await submitProjectAction("/admin/projects", withdrawForm, { id: draft.id }, cookie);
  assert.ok(withdraw.status < 400, `撤下失败：${withdraw.status}`);
  await withdraw.arrayBuffer();
  project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.status, "WITHDRAWN");
  assert.equal(project.firstPublishedAt.toISOString(), firstPublishedAt.toISOString());
  response = await fetch(`${origin}/zh/projects/http-actions-published`);
  assert.equal(response.status, 404);
  response = await fetch(`${origin}/zh/projects`);
  assert.doesNotMatch(await response.text(), /http-actions-published/);

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  publishForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-action"') &&
    form.includes(`name="id" value="${draft.id}"`) &&
    form.includes("重新发布"),
  );
  const republish = await submitProjectAction("/admin/projects", publishForm, { id: draft.id }, cookie);
  assert.ok(republish.status < 400, `重新发布失败：${republish.status}`);
  await republish.arrayBuffer();
  project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.status, "PUBLISHED");
  assert.equal(project.slug, "http-actions-published");
  assert.equal(project.firstPublishedAt.toISOString(), firstPublishedAt.toISOString());

  response = await fetch(`${origin}/admin/projects`, { headers: { cookie } });
  html = await response.text();
  const publishedEditForm = getProjectForm(html, (form) =>
    form.includes('class="admin-project-form"') && form.includes(`name="id" value="${draft.id}"`),
  );
  const renamePublishedProject = await submitProjectAction("/admin/projects", publishedEditForm, {
    id: draft.id,
    slug: "changed-after-first-publish",
    name: "HTTP 操作作品",
    description: "用于验证发布和撤下流程。",
    type: "实验项目",
    cardTarget: "INTERNAL",
    url: "https://trace.example/project",
    coverImage: "",
    body: "## 正文\n\n已完成发布所需内容。",
    contentLanguage: "zh",
  }, cookie);
  assert.ok(renamePublishedProject.status < 400, `编辑已发布作品失败：${renamePublishedProject.status}`);
  await renamePublishedProject.arrayBuffer();
  project = await prisma.project.findUnique({ where: { id: draft.id } });
  assert.equal(project.slug, "http-actions-published", "首次发布后应保留作品地址");
});
