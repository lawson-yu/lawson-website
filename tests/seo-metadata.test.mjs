import assert from "node:assert/strict";
import { describe, test } from "node:test";
import "./register-paths.mjs";

const {
  buildDetailMetadata,
  buildHomeMetadata,
  buildListMetadata,
} = await import("../src/lib/seo.ts");

describe("详情页元数据（ADR 0006 与分享图规则）", () => {
  test("中文正文文章详情：canonical 和 x-default 指向 zh，封面用绝对原图地址", () => {
    const metadata = buildDetailMetadata({
      section: "articles",
      slug: "hello-ai",
      title: "AI 工程实践",
      description: "记录一次模型推理优化。",
      bodyLanguage: "zh",
      coverImageKey: "media/2026/11/cover.jpg",
      publishedTime: new Date("2026-11-20T00:00:00Z"),
      siteOrigin: "https://lawson-codes.dev",
      mediaBaseUrl: "https://media.lawson-codes.dev",
    });

    assert.equal(metadata.metadataBase?.toString(), "https://lawson-codes.dev/");
    assert.equal(metadata.alternates?.canonical, "/zh/articles/hello-ai");
    assert.deepEqual(metadata.alternates?.languages, {
      zh: "/zh/articles/hello-ai",
      en: "/en/articles/hello-ai",
      "x-default": "/zh/articles/hello-ai",
    });
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.openGraph?.locale, "zh_CN");
    assert.deepEqual(metadata.openGraph?.alternateLocale, ["en_US"]);
    assert.equal(metadata.openGraph?.url, "/zh/articles/hello-ai");
    assert.deepEqual(metadata.openGraph?.images, [
      {
        url: "https://media.lawson-codes.dev/media/2026/11/cover.jpg",
        width: 1200,
        height: 630,
        alt: "AI 工程实践",
      },
    ]);
    assert.deepEqual(metadata.twitter?.images, [
      "https://media.lawson-codes.dev/media/2026/11/cover.jpg",
    ]);
  });

  test("英文正文站内项目无封面：canonical 和 x-default 指向 en，分享图回退默认分享图绝对地址", () => {
    const metadata = buildDetailMetadata({
      section: "projects",
      slug: "agent-studio",
      title: "Agent Studio",
      description: "Visual workflow editor for LLM agents.",
      bodyLanguage: "en",
      coverImageKey: null,
      publishedTime: new Date("2026-11-21T00:00:00Z"),
      siteOrigin: "https://lawson-codes.dev",
      mediaBaseUrl: "https://media.lawson-codes.dev",
    });

    assert.equal(metadata.alternates?.canonical, "/en/projects/agent-studio");
    assert.deepEqual(metadata.alternates?.languages, {
      zh: "/zh/projects/agent-studio",
      en: "/en/projects/agent-studio",
      "x-default": "/en/projects/agent-studio",
    });
    assert.equal(metadata.openGraph?.locale, "en_US");
    assert.deepEqual(metadata.openGraph?.alternateLocale, ["zh_CN"]);
    assert.deepEqual(metadata.openGraph?.images, [
      {
        url: "https://lawson-codes.dev/og-default.png",
        width: 1200,
        height: 630,
        alt: "Agent Studio",
      },
    ]);
  });
});

describe("首页与列表页收录边界", () => {
  test("首页与默认列表可收录，包含默认分享图与双语 hreflang", () => {
    const home = buildHomeMetadata({
      locale: "en",
      title: "LAWSON",
      description: "Personal website of Lawson",
      siteOrigin: "https://lawson-codes.dev",
    });
    assert.equal(home.alternates?.canonical, "/en");
    assert.deepEqual(home.alternates?.languages, {
      zh: "/zh",
      en: "/en",
      "x-default": "/zh",
    });
    assert.deepEqual(home.robots, { index: true, follow: true });
    assert.deepEqual(home.openGraph?.images, [
      {
        url: "https://lawson-codes.dev/og-default.png",
        width: 1200,
        height: 630,
        alt: "LAWSON",
      },
    ]);

    const articlesDefault = buildListMetadata({
      locale: "zh",
      section: "articles",
      title: "文章 | LAWSON",
      description: "技术文章列表",
      hasFilterOrLoadState: false,
      siteOrigin: "https://lawson-codes.dev",
    });
    assert.equal(articlesDefault.alternates?.canonical, "/zh/articles");
    assert.deepEqual(articlesDefault.robots, { index: true, follow: true });
  });

  test("带筛选或加载状态的列表不作为独立收录目标", () => {
    const filtered = buildListMetadata({
      locale: "zh",
      section: "articles",
      title: "文章 | LAWSON",
      description: "技术文章列表",
      hasFilterOrLoadState: true,
      siteOrigin: "https://lawson-codes.dev",
    });

    assert.equal(filtered.alternates?.canonical, "/zh/articles");
    assert.deepEqual(filtered.robots, { index: false, follow: true });
  });
});
