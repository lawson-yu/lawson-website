export const ARTICLE_BATCH_SIZE = 6;
export const MAX_ARTICLE_LIMIT = 120;

export function normalizeSearchQuery(raw?: string) {
  if (!raw) return "";
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function clampArticleLimit(raw?: string) {
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < ARTICLE_BATCH_SIZE) {
    return ARTICLE_BATCH_SIZE;
  }
  return Math.min(parsed, MAX_ARTICLE_LIMIT);
}

export function buildArticlesHref(params: {
  q?: string;
  tag?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  const q = normalizeSearchQuery(params.q);
  if (q) search.set("q", q);
  if (params.tag) search.set("tag", params.tag);
  if (
    typeof params.limit === "number" &&
    Number.isSafeInteger(params.limit) &&
    params.limit > ARTICLE_BATCH_SIZE
  ) {
    search.set("limit", String(Math.min(params.limit, MAX_ARTICLE_LIMIT)));
  }
  const queryString = search.toString();
  return queryString ? `/articles?${queryString}` : "/articles";
}

function stripMarkdownToPlainText(markdown: string) {
  const preserved: string[] = [];
  const hold = (content: string) => {
    const index = preserved.push(content) - 1;
    return ` \uE000${index}\uE001 `;
  };

  // 先提取代码块与行内代码，避免正文 Markdown 清理误伤代码中的符号与泛型
  const withoutCode = markdown
    .replace(/(^|\n)[ \t]*(```|~~~)[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g, (_, lead: string, _fence: string, code: string) => `${lead}${hold(code)}`)
    .replace(/`+([^`\n]+)`+/g, (_, code: string) => hold(code));

  const cleaned = withoutCode
    // 移除引用式链接定义，不让目标地址参与匹配
    .replace(/^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S+.*$/gm, " ")
    // 图片与行内链接只保留可见文字
    .replace(/!?\[([^\]]*)\]\((?:[^()\\]|\\.)*\)/g, "$1")
    // 引用式链接只保留可见文字
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    // 自动链接丢弃目标地址
    .replace(/<(?:https?:\/\/|mailto:)[^>]+>/gi, " ")
    // 移除常见 HTML 标签
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    // 移除标题、引用、列表、分隔线和表格分隔符
    .replace(/^[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+\.[ \t]+)/gm, "")
    .replace(/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm, " ")
    .replace(/^[ \t]*\|?(?:[ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*$/gm, " ")
    .replace(/\|/g, " ")
    // 清理转义字符与强调标记，保留标识符内的下划线
    .replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, "$1")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/(^|[^\w])[*_](?=\S)|(?<=\S)[*_](?=$|[^\w])/g, "$1");

  return cleaned.replace(/\uE000(\d+)\uE001/g, (_, index: string) => preserved[Number(index)] ?? "");
}

export function buildArticleSearchText(article: {
  title: string;
  excerpt: string;
  body: string;
}) {
  const plainBody = stripMarkdownToPlainText(article.body);
  return `${article.title} ${article.excerpt} ${plainBody}`
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
