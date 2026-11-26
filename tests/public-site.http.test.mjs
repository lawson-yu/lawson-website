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
  prisma = getPrisma();
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
      cookie,
      origin,
      referer: `${origin}/admin`,
    },
    body: values,
  });
}

test("根路径固定 301 到简体中文首页", async () => {
  const response = await fetch(`${origin}/`, {
    redirect: "manual",
    headers: { "accept-language": "en-US,en;q=0.9" },
  });

  assert.equal(response.status, 301);
  assert.equal(new URL(response.headers.get("location"), origin).pathname, "/zh");
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

test("首页文案和入口随滚动淡出，手机页面仍可正常滚动", async () => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktop.newPage();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();

  try {
    await desktopPage.goto(`${origin}/zh`);
    await desktopPage.evaluate(() => window.scrollTo({ top: innerHeight * 0.75, behavior: "instant" }));
    await desktopPage.waitForFunction(
      () => Number(getComputedStyle(document.querySelector(".home-hero__content")).opacity) < 0.5,
      null,
      { timeout: 5_000 },
    );
    assert.ok(Number(await desktopPage.locator(".home-hero__content").evaluate((element) => getComputedStyle(element).opacity)) < 0.5);

    await mobilePage.goto(`${origin}/zh`);
    const touch = await mobilePage.context().newCDPSession(mobilePage);
    await touch.send("Input.synthesizeScrollGesture", {
      x: 195,
      y: 650,
      yDistance: -320,
      speed: 700,
      gestureSourceType: "touch",
    });
    await mobilePage.waitForFunction(() => scrollY >= 150);
    assert.ok(Number(await mobilePage.locator(".home-hero__content").evaluate((element) => getComputedStyle(element).opacity)) < 1);
    assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await mobilePage.evaluate(() => scrollY > 0));
    await touch.detach();
  } finally {
    await desktop.close();
    await mobile.close();
  }
});

test("桌面角色随指针移动并在指针离开后回到自然姿态", { timeout: 45_000 }, async () => {
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
    assert.equal(await page.locator(".home-hero__primary").isVisible(), true);
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
