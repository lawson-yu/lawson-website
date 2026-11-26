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
import { chromium } from "playwright";
import "./register-paths.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { getPrisma } = await import("../src/server/db.ts");

const ownerEmail = "owner-50@example.test";
const authSecret = "lawson-issue-50-http-test-secret-32-bytes";
const originalDatabaseUrl = process.env.DATABASE_URL;

let testDirectory;
let composeArgs;
let testEnvironment;
let prisma;
let server;
let origin;
let serverOutput = "";
let browser;

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

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    env: testEnvironment,
    encoding: "utf8",
    timeout: 60_000,
  });
}

function sessionCookie(token) {
  const signature = createHmac("sha256", authSecret).update(token).digest("base64");
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

function extractFormHiddenFields(html, predicate) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(([match]) => match);
  const form = forms.find(predicate);
  assert.ok(form, "未找到目标后台表单");
  const fields = [];
  for (const tag of form.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)) {
    const name = tag[0].match(/name="([^"]+)"/)?.[1];
    const value = tag[0].match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) {
      fields.push([name, value.replaceAll("&quot;", '"').replaceAll("&amp;", "&")]);
    }
  }
  assert.ok(fields.length > 0, "表单缺少隐藏字段");
  return fields;
}

async function submitForm(path, hiddenFields, extraValues, cookie) {
  const body = new FormData();
  for (const [name, value] of hiddenFields) body.append(name, value);
  for (const [name, value] of Object.entries(extraValues)) body.set(name, value);
  return fetch(`${origin}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      origin,
      referer: `${origin}${path}`,
    },
    body,
  });
}

async function waitForDatabase(predicate, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(150);
  }
  throw new Error("等待数据库状态更新超时");
}

before(async () => {
  testDirectory = mkdtempSync(join(tmpdir(), "lawson-50-http-test-"));
  const composeFile = join(testDirectory, "compose.yaml");
  const envFile = join(testDirectory, ".env.test");
  const project = `lawson-50-http-${randomUUID().slice(0, 8)}`;
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
  const databaseUrl = `postgresql://test:test@${address}/test`;
  testEnvironment.DATABASE_URL = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
  run("pnpm", ["db:migrate:deploy"]);

  prisma = getPrisma();
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      heroIntroduction: "Lawson 测试介绍",
      contactUrl: "mailto:privacy@example.test",
      socialLinks: [],
    },
    update: {
      contactUrl: "mailto:privacy@example.test",
    },
  });
  await prisma.article.create({
    data: {
      id: "v50-article",
      slug: "v50-article",
      title: "访客记录测试文章",
      excerpt: "用于验证已登录访客阅读记录。",
      bodyLanguage: "zh",
      body: "## 第一节\n\n测试正文。",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-20T00:00:00Z"),
    },
  });
  await prisma.project.create({
    data: {
      id: "v50-project",
      slug: "v50-project",
      name: "访客记录测试项目",
      description: "用于验证已登录访客项目访问记录。",
      type: "开发工具",
      body: "## 项目说明\n\n站内项目正文。",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-11-20T00:00:00Z"),
    },
  });

  const port = await reservePort();
  origin = `http://127.0.0.1:${port}`;
  server = spawn("pnpm", ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: authSecret,
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      ADMIN_EMAILS: ownerEmail,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`开发服务器提前退出（${server.exitCode}）：\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${origin}/zh`);
      if (response.status === 200) break;
    } catch {
      // 等待启动
    }
    await delay(250);
  }

  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), delay(5_000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  try {
    await prisma?.$disconnect();
  } finally {
    if (composeArgs) {
      try {
        run("docker", [...composeArgs, "down", "-v"]);
      } finally {
        rmSync(testDirectory, { recursive: true, force: true });
      }
    }
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("中英文公开界面均可查阅隐私说明，明确记录范围、24 个月保留期与删除方式", async () => {
  const zhRes = await fetch(`${origin}/zh/privacy`);
  assert.equal(zhRes.status, 200);
  const zhHtml = await zhRes.text();
  assert.match(zhHtml, /隐私说明/);
  assert.match(zhHtml, /24 个月/);
  assert.match(zhHtml, /删除/);
  assert.match(zhHtml, /邮箱/);
  assert.match(zhHtml, /显示名/);
  assert.match(zhHtml, /首次登录/);
  assert.match(zhHtml, /最近登录/);
  assert.match(zhHtml, /文章/);
  assert.match(zhHtml, /项目/);
  assert.match(zhHtml, /mailto:privacy@example\.test/);

  const enRes = await fetch(`${origin}/en/privacy`);
  assert.equal(enRes.status, 200);
  const enHtml = await enRes.text();
  assert.match(enHtml, /Privacy/i);
  assert.match(enHtml, /24 months/i);
  assert.match(enHtml, /delet/i);
  assert.match(enHtml, /mailto:privacy@example\.test/);

  // 页脚包含隐私说明入口
  const homeZh = await (await fetch(`${origin}/zh`)).text();
  assert.match(homeZh, /href="\/zh\/privacy"/);
  const homeEn = await (await fetch(`${origin}/en`)).text();
  assert.match(homeEn, /href="\/en\/privacy"/);
});

test("匿名浏览与仅服务端获取不计入访问，已登录访客打开详情计数，站长可查看、清理并级联删除，非站长无法读写", async () => {
  const ownerToken = `owner-tok-${randomUUID()}`;
  const visitorToken = `visitor-tok-${randomUUID()}`;
  const ownerId = `owner-${randomUUID()}`;
  const visitorId = `visitor-${randomUUID()}`;

  await prisma.user.create({
    data: {
      id: ownerId,
      name: "Lawson Owner",
      email: ownerEmail,
      emailVerified: true,
      firstLoginAt: new Date("2026-11-01T00:00:00Z"),
      lastLoginAt: new Date("2026-11-25T00:00:00Z"),
      sessions: {
        create: {
          id: `sess-${randomUUID()}`,
          token: ownerToken,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      id: visitorId,
      name: "Bob Visitor",
      email: "bob-visitor@example.test",
      emailVerified: true,
      firstLoginAt: new Date("2026-11-10T08:00:00Z"),
      lastLoginAt: new Date("2026-11-24T12:00:00Z"),
      sessions: {
        create: {
          id: `sess-${randomUUID()}`,
          token: visitorToken,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      },
      accounts: {
        create: {
          id: `acc-${randomUUID()}`,
          accountId: "google-bob",
          providerId: "google",
        },
      },
    },
  });

  const ownerCookie = sessionCookie(ownerToken);
  const visitorCookie = sessionCookie(visitorToken);

  // 1. 匿名浏览器访问详情不记录
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`${origin}/zh/articles/v50-article`, { waitUntil: "networkidle" });
  await anonPage.goto(`${origin}/zh/projects/v50-project`, { waitUntil: "networkidle" });
  await anonContext.close();
  assert.equal(await prisma.articleVisit.count(), 0);
  assert.equal(await prisma.projectVisit.count(), 0);

  // 2. 已登录访客仅发起服务端 GET（模拟预取/RSC）不记录
  assert.equal(
    (await fetch(`${origin}/zh/articles/v50-article`, { headers: { cookie: visitorCookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(`${origin}/zh/projects/v50-project`, { headers: { cookie: visitorCookie } })).status,
    200,
  );
  assert.equal(await prisma.articleVisit.count(), 0);
  assert.equal(await prisma.projectVisit.count(), 0);

  // 3. 已登录访客在浏览器实际打开文章和站内项目详情 -> 记录且复访递增
  const visitorContext = await browser.newContext();
  await visitorContext.addCookies([
    {
      name: "better-auth.session_token",
      value: visitorCookie.slice("better-auth.session_token=".length),
      url: origin,
    },
  ]);
  const visitorPage = await visitorContext.newPage();
  await visitorPage.goto(`${origin}/zh/articles/v50-article`, { waitUntil: "networkidle" });
  await waitForDatabase(async () => (await prisma.articleVisit.count({ where: { visitorId } })) === 1);
  await visitorPage.goto(`${origin}/zh/projects/v50-project`, { waitUntil: "networkidle" });
  await waitForDatabase(async () => (await prisma.projectVisit.count({ where: { visitorId } })) === 1);

  // 再次打开文章详情，访问次数应增加到 2
  await visitorPage.goto(`${origin}/zh/articles/v50-article`, { waitUntil: "networkidle" });
  await waitForDatabase(async () => {
    const v = await prisma.articleVisit.findUnique({
      where: { visitorId_articleId: { visitorId, articleId: "v50-article" } },
    });
    return v?.visitCount === 2;
  });
  await visitorContext.close();

  // 4. 权限边界：匿名重定向，非站长 404
  const anonAdmin = await fetch(`${origin}/admin/visitors`, { redirect: "manual" });
  assert.equal(anonAdmin.status, 307);
  const visitorAdmin = await fetch(`${origin}/admin/visitors`, {
    headers: { cookie: visitorCookie },
    redirect: "manual",
  });
  assert.equal(visitorAdmin.status, 404);

  // 5. 站长查看后台访客记录
  const ownerAdminRes = await fetch(`${origin}/admin/visitors`, {
    headers: { cookie: ownerCookie },
  });
  assert.equal(ownerAdminRes.status, 200);
  const ownerAdminHtml = await ownerAdminRes.text();
  assert.match(ownerAdminHtml, /bob-visitor@example\.test/);
  assert.match(ownerAdminHtml, /Bob Visitor/);
  assert.match(ownerAdminHtml, /访客记录测试文章/);
  assert.match(ownerAdminHtml, /访客记录测试项目/);
  assert.match(ownerAdminHtml, /首次登录/);
  assert.match(ownerAdminHtml, /最近登录/);
  assert.match(ownerAdminHtml, /文章访问/);
  assert.match(ownerAdminHtml, /项目访问/);
  assert.match(ownerAdminHtml.replaceAll("<!-- -->", ""), /2 次/);

  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ownerContext.addCookies([{
    name: "better-auth.session_token",
    value: ownerCookie.slice("better-auth.session_token=".length),
    url: origin,
  }]);
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${origin}/admin/visitors`, { waitUntil: "networkidle" });
  let deletionDialogMessage;
  ownerPage.once("dialog", async (dialog) => {
    deletionDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await ownerPage.getByRole("button", { name: `删除访客 bob-visitor@example.test` }).click();
  assert.match(deletionDialogMessage, /bob-visitor@example\.test/);
  assert.ok(await prisma.user.findUnique({ where: { id: visitorId } }));
  await ownerContext.close();

  // 准备一条超过 24 个月的过期记录，验证清理表单与防越权
  const oldArticle = await prisma.article.create({
    data: {
      id: "v50-old-article",
      slug: "v50-old-article",
      title: "过期测试文章",
      excerpt: "摘要",
      bodyLanguage: "zh",
      body: "## 旧文",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2023-01-01T00:00:00Z"),
    },
  });
  await prisma.articleVisit.create({
    data: {
      visitorId,
      articleId: oldArticle.id,
      firstVisitedAt: new Date("2023-05-01T00:00:00Z"),
      lastVisitedAt: new Date("2023-05-02T00:00:00Z"),
      visitCount: 1,
    },
  });

  const pruneForm = extractFormHiddenFields(ownerAdminHtml, (form) =>
    form.includes('data-action="prune-visitor-records"'),
  );
  const deleteForm = extractFormHiddenFields(
    ownerAdminHtml,
    (form) =>
      form.includes('data-action="delete-visitor"') && form.includes(`value="${visitorId}"`),
  );

  // 非站长与匿名不能执行清理或删除
  for (const unauthorizedCookie of [undefined, visitorCookie]) {
    const pruneAttempt = await submitForm("/admin/visitors", pruneForm, {}, unauthorizedCookie);
    assert.notEqual(pruneAttempt.status, 200);
    const deleteAttempt = await submitForm(
      "/admin/visitors",
      deleteForm,
      { visitorId },
      unauthorizedCookie,
    );
    assert.notEqual(deleteAttempt.status, 200);
  }
  assert.equal(await prisma.articleVisit.count({ where: { visitorId } }), 2);
  assert.ok(await prisma.user.findUnique({ where: { id: visitorId } }));

  // 6. 站长执行 24 个月清理
  const pruneOk = await submitForm("/admin/visitors", pruneForm, {}, ownerCookie);
  assert.equal(pruneOk.status, 200);
  assert.equal(await prisma.articleVisit.count({ where: { visitorId } }), 1);

  // 7. 站长删除测试访客账号 -> 级联删除会话、账号与访问记录
  const deleteOk = await submitForm("/admin/visitors", deleteForm, { visitorId }, ownerCookie);
  assert.equal(deleteOk.status, 200);
  assert.equal(await prisma.user.findUnique({ where: { id: visitorId } }), null);
  assert.equal(await prisma.session.count({ where: { userId: visitorId } }), 0);
  assert.equal(await prisma.account.count({ where: { userId: visitorId } }), 0);
  assert.equal(await prisma.articleVisit.count({ where: { visitorId } }), 0);
  assert.equal(await prisma.projectVisit.count({ where: { visitorId } }), 0);

  // 被删访客的会话立即失效
  const deletedSessionRes = await fetch(`${origin}/api/auth/get-session`, {
    headers: { cookie: visitorCookie },
  });
  assert.equal(await deletedSessionRes.json(), null);
});
