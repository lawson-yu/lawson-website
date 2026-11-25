import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";

const projectRoot = new URL("../", import.meta.url);
let server;
let origin;
let serverOutput = "";

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
  server = spawn(
    "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BETTER_AUTH_URL: "",
        BETTER_AUTH_SECRET: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ADMIN_EMAILS: "",
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
      await fetch(`${origin}/`, { redirect: "manual" });
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

test("根路径固定 301 到简体中文首页", async () => {
  const response = await fetch(`${origin}/`, {
    redirect: "manual",
    headers: { "accept-language": "en-US,en;q=0.9" },
  });

  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/zh");
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
