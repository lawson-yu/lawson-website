import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";
import { makeSignature } from "better-auth/crypto";
import { Client } from "pg";

const projectRoot = new URL("../", import.meta.url);
let server;
let origin;
let serverOutput = "";
let ownerCookie;

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
    if (name && attribute(tag, "type") === "hidden") formData.append(name, value ?? "");
    else if (name) formData.set(name, value ?? "");
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
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  formData.set("intent", intent);

  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { cookie: ownerCookie, origin },
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

before(async () => {
  const port = await reservePort();
  origin = `http://127.0.0.1:${port}`;
  const nextCommand = process.env.TEST_NEXT_COMMAND === "start" ? "start" : "dev";
  server = spawn(
    "pnpm",
    ["exec", "next", nextCommand, "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BETTER_AUTH_URL: process.env.TEST_AUTH_SECRET ? origin : "",
        BETTER_AUTH_SECRET: process.env.TEST_AUTH_SECRET ?? "",
        GOOGLE_CLIENT_ID: process.env.TEST_AUTH_SECRET ? "test-client-id" : "",
        GOOGLE_CLIENT_SECRET: process.env.TEST_AUTH_SECRET ? "test-client-secret" : "",
        ADMIN_EMAILS: process.env.TEST_ADMIN_EMAILS ?? "",
      },
    },
  );
  server.stdout.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  server.stderr.setEncoding("utf8").on("data", (chunk) => (serverOutput += chunk));
  const sessionToken = process.env.TEST_OWNER_SESSION_TOKEN;
  const secret = process.env.TEST_AUTH_SECRET;
  if (sessionToken && secret) {
    ownerCookie = `better-auth.session_token=${sessionToken}.${await makeSignature(sessionToken, secret)}`;
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next.js 提前退出：\n${serverOutput}`);
    try {
      await fetch(`${origin}/`);
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Next.js 启动超时：\n${serverOutput}`);
}, { timeout: 65_000 });

after(async () => {
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(5_000)]);
});

test("双语文章列表与详情仅公开已发布文章，其他地址返回真实 404", async () => {
  const production = process.env.TEST_NEXT_COMMAND === "start";

  for (const locale of ["zh", "en"]) {
    const listResponse = await fetch(`${origin}/${locale}/articles`);
    const list = await listResponse.text();

    assert.equal(listResponse.status, 200);
    assert.match(list, locale === "zh" ? /最新文章/ : /Latest articles/);

    if (production) {
      assert.match(list, /文章正在整理中|Articles are being prepared/);
    } else {
      assert.match(list, /已发布的文章/);
      assert.match(list, new RegExp(`href="/${locale}/articles/published-article"`));
      assert.doesNotMatch(list, /未发布的文章|已撤下的文章/);

      const detailResponse = await fetch(`${origin}/${locale}/articles/published-article`);
      const detail = await detailResponse.text();

      assert.equal(detailResponse.status, 200);
      assert.match(detail, /已发布的文章/);
      assert.match(detail, /Lawson/);
      assert.match(detail, /主要内容/);
      assert.match(detail, /<h2 id="主要内容">/);
      assert.match(detail, /article-reading__tags/);
      assert.match(detail, /AI/);
      assert.match(detail, /article-reading__cover/);
      assert.match(detail, /<time dateTime=/i);
      assert.match(detail, /文章摘要/);
      assert.match(detail, new RegExp(`<html[^>]*lang="${locale}"`));
      assert.match(detail, /<article[^>]*lang="zh"/);
    }
  }

  for (const locale of ["zh", "en"]) {
    for (const slug of ["missing-article", "draft-article", "withdrawn-article"]) {
      const response = await fetch(`${origin}/${locale}/articles/${slug}`);
      const body = await response.text();

      assert.equal(response.status, 404, `${locale}/${slug} 必须返回 HTTP 404`);
      assert.match(body, new RegExp(`href="/${locale}/articles"`));
    }
  }
});

test("站长可以管理文章，并通过 Server Action 完成发布生命周期", async () => {
  assert.ok(ownerCookie, "集成数据库应提供站长测试会话");
  const headers = { cookie: ownerCookie };
  const listResponse = await fetch(`${origin}/admin/articles`, { headers });
  const list = await listResponse.text();

  assert.equal(listResponse.status, 200);
  assert.match(list, /文章管理/);

  const editorResponse = await fetch(`${origin}/admin/articles/new`, { headers });
  const editor = await editorResponse.text();

  assert.equal(editorResponse.status, 200);
  assert.match(editor, /保存草稿/);
  assert.match(editor, /发布文章/);
  assert.match(editor, /data-confirm="确认首次发布到 \/articles\/… 吗？"/);

  const invalidPublish = await submitArticleForm(
    "/admin/articles/new",
    editor,
    "publish",
  );
  const invalidPublishBody = await invalidPublish.text();
  assert.equal(
    invalidPublish.status,
    200,
    `表单响应异常：${invalidPublishBody.slice(0, 1000)}\n表单：${editor.match(/<form\b[^>]*>[\s\S]*?<\/form>/)?.[0].slice(0, 1600)}\nNext：${serverOutput.slice(-2000)}`,
  );
  const validation = invalidPublishBody;
  for (const missing of ["标题", "摘要", "正文语言", "正文", "文章网址"]) {
    assert.match(validation, new RegExp(missing));
  }

  const draftResponse = await submitArticleForm(
    "/admin/articles/new",
    editor,
    "save",
    { title: "工单四十测试文章" },
  );
  const draftPath = redirectPath(draftResponse);
  assert.ok(draftPath?.startsWith("/admin/articles/"), "保存草稿后应进入文章编辑页");

  const draftEditorResponse = await fetch(`${origin}${draftPath}`, { headers });
  assert.equal(draftEditorResponse.status, 200);
  const draftEditor = await draftEditorResponse.text();
  assert.match(draftEditor, /保存草稿/);
  const slug = `issue-40-${Date.now()}`;
  const publishedResponse = await submitArticleForm(
    draftPath,
    draftEditor,
    "publish",
    {
      title: "工单四十测试文章",
      excerpt: "用于验证公开发布和撤下恢复。",
      bodyLanguage: "zh",
      body: "## 发布正文\n\n正文中的测试内容。",
      slug,
    },
  );
  const publishedPath = redirectPath(publishedResponse);
  assert.equal(publishedPath, draftPath);

  const firstPublicResponse = await fetch(`${origin}/zh/articles/${slug}`);
  assert.equal(firstPublicResponse.status, 200);
  assert.match(await firstPublicResponse.text(), /发布正文/);
  const firstListResponse = await fetch(`${origin}/zh/articles`);
  assert.match(await firstListResponse.text(), /工单四十测试文章/);

  const database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();
  const firstPublication = await database.query(
    'SELECT "firstPublishedAt" FROM "Article" WHERE "slug" = $1',
    [slug],
  );
  const firstPublishedAt = firstPublication.rows[0]?.firstPublishedAt;
  assert.ok(firstPublishedAt instanceof Date, "首次发布应记录时间");
  await database.end();

  const publishedEditorResponse = await fetch(`${origin}${publishedPath}`, { headers });
  const publishedEditor = await publishedEditorResponse.text();
  assert.match(publishedEditor, /保存并立即公开/);
  assert.match(publishedEditor, /data-confirm="保存后文章将立即更新到公开页面/);
  assert.match(publishedEditor, /撤下文章/);
  assert.match(publishedEditor, /data-confirm="撤下后文章会从公开列表和收录入口移除/);
  assert.doesNotMatch(publishedEditor, /name="intent" value="publish"/);

  const changedSlug = await submitArticleForm(
    publishedPath,
    publishedEditor,
    "save",
    { slug: `${slug}-changed` },
  );
  assert.equal(changedSlug.status, 200);
  assert.match(await changedSlug.text(), /文章发布后网址固定/);

  const withdrawnResponse = await submitArticleForm(publishedPath, publishedEditor, "withdraw");
  assert.equal(redirectPath(withdrawnResponse), publishedPath);
  const withdrawnPublicResponse = await fetch(`${origin}/zh/articles/${slug}`);
  assert.equal(withdrawnPublicResponse.status, 404);
  const withdrawnListResponse = await fetch(`${origin}/zh/articles`);
  assert.doesNotMatch(await withdrawnListResponse.text(), /工单四十测试文章/);

  const withdrawnEditorResponse = await fetch(`${origin}${publishedPath}`, { headers });
  const withdrawnEditor = await withdrawnEditorResponse.text();
  assert.match(withdrawnEditor, /重新发布/);
  const republishResponse = await submitArticleForm(
    publishedPath,
    withdrawnEditor,
    "publish",
  );
  assert.equal(redirectPath(republishResponse), publishedPath);

  const republishedResponse = await fetch(`${origin}/en/articles/${slug}`);
  assert.equal(republishedResponse.status, 200);
  const republished = await republishedResponse.text();
  assert.match(republished, /工单四十测试文章/);
  const republishedListResponse = await fetch(`${origin}/en/articles`);
  assert.match(await republishedListResponse.text(), /工单四十测试文章/);

  const confirmation = new Client({ connectionString: process.env.DATABASE_URL });
  await confirmation.connect();
  const finalRecord = await confirmation.query(
    'SELECT "firstPublishedAt", "status" FROM "Article" WHERE "slug" = $1',
    [slug],
  );
  await confirmation.end();
  assert.equal(finalRecord.rows[0]?.status, "PUBLISHED");
  assert.equal(finalRecord.rows[0]?.firstPublishedAt?.toISOString(), firstPublishedAt.toISOString());

  const resultPath = process.env.TEST_ARTICLE_ACTION_RESULT;
  if (resultPath) {
    await writeFile(resultPath, JSON.stringify({ slug, articleId: publishedPath.split("/").at(-1) }));
  }
});
