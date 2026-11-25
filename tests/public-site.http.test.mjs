import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const projectRoot = new URL("../", import.meta.url);
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
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js 提前退出：\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${origin}/zh`);
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      await delay(250);
    }
  }
  if (!ready) throw new Error(`Next.js 启动超时：\n${serverOutput}`);
  browser = await chromium.launch({
    args: ["--enable-webgl", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
  });
}, { timeout: 65_000 });

after(async () => {
  await browser?.close();
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
