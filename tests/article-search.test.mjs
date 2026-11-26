import assert from "node:assert/strict";
import { test } from "node:test";
import "./register-paths.mjs";
import {
  ARTICLE_BATCH_SIZE,
  MAX_ARTICLE_LIMIT,
  buildArticleSearchText,
  buildArticlesHref,
  clampArticleLimit,
  normalizeSearchQuery,
} from "../src/lib/article-search.ts";

test("buildArticleSearchText 保留标题、摘要、正文、代码与链接可见文字，移除 Markdown 标记与链接目标", () => {
  const text = buildArticleSearchText({
    title: "Next.js 缓存实践",
    excerpt: "使用 PostgreSQL 检索中英文内容。",
    body: [
      "## 架构说明",
      "",
      "这里包含 **加粗说明**、*斜体提示*、`inline_code_token` 和 [可见链接文字](https://hidden-target.example/secret-path?x=1)。",
      "",
      "![封面描述](https://media.example/hidden-image.webp)",
      "",
      "[参考文档][ref-1]",
      "",
      "[ref-1]: https://hidden-ref.example/never-match",
      "",
      "<https://hidden-autolink.example/nope>",
      "",
      "```ts",
      "export function query_articles(limit: Array<string>) {",
      "  return 'CODE_SNIPPET_TOKEN';",
      "}",
      "```",
      "",
      "> 引用里的 连续中文词组 测试。",
    ].join("\n"),
  });

  assert.match(text, /Next\.js 缓存实践/);
  assert.match(text, /PostgreSQL 检索中英文内容/);
  assert.match(text, /架构说明/);
  assert.match(text, /加粗说明/);
  assert.match(text, /斜体提示/);
  assert.match(text, /inline_code_token/);
  assert.match(text, /可见链接文字/);
  assert.match(text, /封面描述/);
  assert.match(text, /参考文档/);
  assert.match(text, /query_articles\(limit: Array<string>\)/);
  assert.match(text, /CODE_SNIPPET_TOKEN/);
  assert.match(text, /连续中文词组/);

  assert.doesNotMatch(text, /##/);
  assert.doesNotMatch(text, /\*\*/);
  assert.doesNotMatch(text, /```/);
  assert.doesNotMatch(text, /hidden-target\.example/);
  assert.doesNotMatch(text, /secret-path/);
  assert.doesNotMatch(text, /hidden-image\.webp/);
  assert.doesNotMatch(text, /hidden-ref\.example/);
  assert.doesNotMatch(text, /never-match/);
  assert.doesNotMatch(text, /hidden-autolink\.example/);
  assert.doesNotMatch(text, /\[ref-1\]/);
});

test("buildArticleSearchText 与 normalizeSearchQuery 执行 NFKC 归一化并折叠空白", () => {
  const text = buildArticleSearchText({
    title: "ＦｕｌｌＷｉｄｔｈ　标题",
    excerpt: "  多   空格  ",
    body: "普通\n\n正文",
  });
  assert.equal(text, "FullWidth 标题 多 空格 普通 正文");
  assert.equal(normalizeSearchQuery("  Ｒｅｄｉｓ　  缓存  "), "Redis 缓存");
  assert.equal(normalizeSearchQuery("   "), "");
  assert.equal(normalizeSearchQuery(undefined), "");
});

test("clampArticleLimit 限制下限为首批大小且不超过最大上限", () => {
  assert.equal(clampArticleLimit(undefined), ARTICLE_BATCH_SIZE);
  assert.equal(clampArticleLimit("abc"), ARTICLE_BATCH_SIZE);
  assert.equal(clampArticleLimit("0"), ARTICLE_BATCH_SIZE);
  assert.equal(clampArticleLimit("3"), ARTICLE_BATCH_SIZE);
  assert.equal(clampArticleLimit("12"), 12);
  assert.equal(clampArticleLimit(String(MAX_ARTICLE_LIMIT + 500)), MAX_ARTICLE_LIMIT);
  assert.equal(clampArticleLimit("999999999"), MAX_ARTICLE_LIMIT);
});

test("buildArticlesHref 按参数稳定生成文章列表链接", () => {
  assert.equal(buildArticlesHref({}), "/articles");
  assert.equal(buildArticlesHref({ q: "  Redis 缓存 " }), "/articles?q=Redis+%E7%BC%93%E5%AD%98");
  assert.equal(buildArticlesHref({ tag: "tag-ai" }), "/articles?tag=tag-ai");
  assert.equal(
    buildArticlesHref({ q: "Redis", tag: "tag-ai", limit: 12 }),
    "/articles?q=Redis&tag=tag-ai&limit=12",
  );
  assert.equal(
    buildArticlesHref({ q: "Redis", limit: ARTICLE_BATCH_SIZE }),
    "/articles?q=Redis",
  );
});
