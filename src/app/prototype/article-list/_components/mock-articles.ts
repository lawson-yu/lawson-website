// 原型数据（issue #30）：示例文章，仅用于评审文章列表的形态与状态。一次性代码。

export type Article = {
  slug: string;
  title: string;
  summary: string;
  /** 首次发布日期 */
  date: string;
  tags: string[];
  lang: "zh" | "en";
  /** 封面可选：第 1 页里间隔分布，用来同时看到有封面与无封面的卡片。 */
  cover?: string;
};

export const ARTICLES: Article[] = [
  {
    slug: "acceptance-scenarios-first",
    cover: "/prototype/covers/cover-1.webp",
    title: "如何让 AI 先写验收场景",
    summary: "从一个模糊需求开始，写出一条可验证的操作路径，再让模型动手。顺序反了，返工就变成了常态。",
    date: "2026-11-18",
    tags: ["AI 编程", "工作流"],
    lang: "zh",
  },
  {
    slug: "acceptance-in-prompt",
    title: "我为什么把验收标准写进提示词",
    summary: "验收标准放在 issue 里，模型读不到；写进提示词，它才会在每个回合自己对照。",
    date: "2026-11-04",
    tags: ["AI 编程"],
    lang: "zh",
  },
  {
    slug: "searchable-local-knowledge-base",
    cover: "/prototype/covers/cover-2.webp",
    title:
      "把三年积累的 AI 工作流搬进一个可搜索的本地知识库：从文件夹命名、切片策略到检索评测的完整复盘",
    summary: "最耗时间的不是建库，而是让切片后的片段还能读懂自己。这篇记录我踩过的命名、切分和召回问题。",
    date: "2026-10-21",
    tags: ["工作流", "工具"],
    lang: "zh",
  },
  {
    slug: "claude-project-instructions",
    title: "Claude 项目指令的三种写法，以及它们各自失控的方式",
    summary: "清单式、角色式、示例式，各有各的失败姿势。附上我最后留下的那一种。",
    date: "2026-10-09",
    tags: ["AI 编程", "模型"],
    lang: "zh",
  },
  {
    slug: "playwright-form-regression",
    cover: "/prototype/covers/cover-3.webp",
    title: "用 Playwright 给一个不会报错的表单写回归",
    summary: "它不崩，只是悄悄少存了一个字段。这类 bug 只能靠断言写出来。",
    date: "2026-09-25",
    tags: ["前端", "工具"],
    lang: "zh",
  },
  {
    slug: "context-window-400k",
    title: "上下文窗口不是越大越好：一次 40 万 token 的教训",
    summary: "塞满之后模型开始忽略中间的内容，成本翻了三倍，答案质量反而下降。",
    date: "2026-09-11",
    tags: ["模型", "复盘"],
    lang: "zh",
  },
  {
    slug: "design-tokens-survive-redesign",
    cover: "/prototype/covers/cover-4.webp",
    title: "Design tokens that survive a redesign",
    summary: "Tokens named after their role outlive the layout that produced them. A short note on what I keep and what I rename.",
    date: "2026-08-28",
    tags: ["设计", "前端"],
    lang: "en",
  },
  {
    slug: "stable-json-output",
    title: "让 LLM 稳定输出 JSON 的四个约束",
    summary: "schema、示例、拒绝分支和重试上限。缺一个，夜里就会收到解析失败的告警。",
    date: "2026-08-14",
    tags: ["模型", "AI 编程"],
    lang: "zh",
  },
  {
    slug: "rag-before-evals",
    cover: "/prototype/covers/cover-5.webp",
    title: "从零搭一个能用的 RAG，先别管评测",
    summary: "先用十篇真文章跑通召回，再谈指标。过早做评测只会优化一个你还没定义的问题。",
    date: "2026-07-30",
    tags: ["工具", "模型"],
    lang: "zh",
  },
  {
    slug: "solo-fullstack-complexity",
    cover: "/prototype/covers/cover-6.webp",
    title: "单人维护一个全栈项目，我把复杂度花在哪里",
    summary: "删掉取数层、删掉状态库，把复杂度集中在内容模型上。",
    date: "2026-07-16",
    tags: ["复盘"],
    lang: "zh",
  },
  {
    slug: "smooth-scroll-direction",
    title: "逐帧对比：为什么平滑滚动会让滚动方向判定出错",
    summary: "收尾阶段每帧回漂约 1px，逐帧比较就会被判成向上滚动。改成累计位移之后才稳定。",
    date: "2026-07-02",
    tags: ["前端", "复盘"],
    lang: "zh",
  },
  {
    slug: "prompts-are-not-docs",
    title: "提示词不是文档：给同事看的 AI 编程约定该怎么写",
    summary: "文档描述状态，提示词约束动作。混着写，两边都读不懂。",
    date: "2026-06-18",
    tags: ["写作", "AI 编程"],
    lang: "zh",
  },
  {
    slug: "one-vps-docker",
    title: "用 Docker 在一台 VPS 上跑完全部服务",
    summary: "单实例、单反向代理、单备份脚本。省下的不是钱，是要维护的心智。",
    date: "2026-06-04",
    tags: ["工具"],
    lang: "zh",
  },
  {
    slug: "tickets-before-code",
    title: "把需求拆成 ticket 之后，AI 写代码才不再跑偏",
    summary: "一张票只回答一个问题，工作流里的每一步都有可验证的出口，模型才有地方停下。",
    date: "2026-05-21",
    tags: ["工作流", "AI 编程"],
    lang: "zh",
  },
  {
    slug: "point-cloud-mobile-fallback",
    title: "Three.js 点云角色的移动端降级方案",
    summary: "同一机位截一张静态图，加载中、减少动态效果、加载失败三种状态共用它。",
    date: "2026-05-07",
    tags: ["前端", "设计"],
    lang: "zh",
  },
  {
    slug: "dark-ui-hierarchy",
    title: "深色界面里最难调的不是对比度，是层次",
    summary: "对比度查表就能过，层次要靠三级底色和一条发丝线撑住。",
    date: "2026-04-23",
    tags: ["设计"],
    lang: "zh",
  },
  {
    slug: "chinese-search",
    title: "给中文内容做搜索：为什么内置全文检索不够用",
    summary: "中文没有空格，按词切分的全文检索认不出连续词组。归一化之后用 ILIKE 反而够用。",
    date: "2026-04-09",
    tags: ["工具", "模型"],
    lang: "zh",
  },
  {
    slug: "failed-weekly-report-automation",
    title: "一次失败的自动化：把周报交给 AI 之后",
    summary: "它写得很像，但每周都要我改回原样。问题不在模型，在输入。",
    date: "2026-03-26",
    tags: ["复盘", "工作流"],
    lang: "zh",
  },
  {
    slug: "figma-to-code-layers",
    title: "从 Figma 到代码，我删掉了哪些中间层",
    summary: "不留组件映射表，不留设计稿快照。留下的只有一套单位和四个圆角。",
    date: "2026-03-12",
    tags: ["设计", "前端"],
    lang: "zh",
  },
  {
    slug: "prompt-caching-cost",
    title: "Prompt caching 的成本账",
    summary: "命中率超过多少才值得改写提示词结构，我按自己的调用量算了一遍。",
    date: "2026-02-26",
    tags: ["模型", "工具"],
    lang: "zh",
  },
  {
    slug: "three-things-in-review",
    title: "代码评审时我只看三件事",
    summary: "改动能不能追溯到一个请求，边界有没有校验，失败之后数据还在不在。",
    date: "2026-02-12",
    tags: ["复盘", "AI 编程"],
    lang: "zh",
  },
  {
    slug: "translate-technical-terms",
    title: "中文写作里的技术词该不该翻译",
    summary: "读者在搜索框里输入的是英文原词还是译名，决定了正文该用哪个。",
    date: "2026-01-29",
    tags: ["写作"],
    lang: "zh",
  },
  {
    slug: "css-unit-system",
    title: "用 CSS 单位系统对齐一套设计稿",
    summary: "一个 --u 撑住全部尺寸，换断点只改它的定义。",
    date: "2026-01-15",
    tags: ["前端", "设计"],
    lang: "zh",
  },
  {
    slug: "visitor-records-two-tables",
    title: "把访问记录做成两张表就够了",
    summary: "账号一张、访问一张，保留期写在清理任务里，删除按账号级联。",
    date: "2025-12-18",
    tags: ["工具"],
    lang: "zh",
  },
  {
    slug: "no-cover-images",
    title: "为什么我不再给文章加封面图",
    summary: "列表里多一张图，扫读就慢一拍。信息密度应该留给标题和摘要。",
    date: "2025-11-27",
    tags: ["写作", "设计"],
    lang: "zh",
  },
  {
    slug: "bilingual-without-translating",
    title: "Shipping a bilingual site without translating the content",
    summary: "Interface in two languages, articles in the language they were written in. What that costs and why it is worth it.",
    date: "2025-10-30",
    tags: ["写作", "前端"],
    lang: "en",
  },
  {
    slug: "first-post",
    title: "第一篇文章：我打算在这里写什么",
    summary: "AI 工具怎么用、卡在哪里、最后留下了什么。只写自己跑通过的部分。",
    date: "2025-09-25",
    tags: ["写作"],
    lang: "zh",
  },
];

/** 列表里出现的全部标签，按文章数量倒序。 */
export const TAGS: { name: string; count: number }[] = Array.from(
  ARTICLES.reduce((map, article) => {
    for (const tag of article.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    return map;
  }, new Map<string, number>()),
)
  .map(([name, count]) => ({ name, count }))
  // 不用 localeCompare：服务端与浏览器的 ICU 排序不一致，会造成 hydration 不匹配。
  .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
