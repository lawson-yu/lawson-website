import { buildArticleSearchText } from "../src/lib/article-search.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("缺少 DATABASE_URL 环境变量");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const projects = [
  {
    slug: "personal-website",
    name: "个人网站",
    description: "用于展示个人介绍、文章和作品的个人网站示例项目。",
    type: "个人网站",
    cardTarget: "EXTERNAL" as const,
    status: "PUBLISHED" as const,
    url: "https://example.com",
    featuredRank: 1,
  },
  {
    slug: "open-source-tool",
    name: "开源工具",
    description: "记录一个开源工具项目的简介与访问入口。",
    type: "开发工具",
    cardTarget: "EXTERNAL" as const,
    status: "PUBLISHED" as const,
    url: "https://github.com/example",
    featuredRank: 2,
  },
  {
    slug: "side-project",
    name: "实验性小项目",
    description: "用于展示个人实践与实验成果的示例条目。",
    type: "实验项目",
    cardTarget: "INTERNAL" as const,
    status: "DRAFT" as const,
    url: null,
    featuredRank: null,
  },
];

const demoArticles = [
  {
    slug: "demo-reading-route",
    title: "先设计阅读路线，再设计首页",
    excerpt: "首页不必塞满所有内容；先决定访客从哪里进入、读完后可以去哪里。",
    bodyLanguage: "zh",
    body: `# 先画出访客的阅读路线

一个内容型个人网站通常同时展示介绍、文章和作品。首页空间有限，与其把每项内容都缩成一张卡片，不如先想清楚访客最可能做的下一步。

## 三个清楚的入口

- **认识站点**：用一段简短介绍交代这里记录什么。
- **继续阅读**：精选文章代表最近值得打开的想法。
- **查看作品**：作品卡片说明做了什么，并提供站内详情。

这些入口各自回答不同的问题。标题可以有个性，说明仍然要直白。

## 排序也是一种说明

精选顺序应当表达编辑判断，而不是更新时间的副产品。本文的示例把文章列表、精选文章和作品分别处理：访客能看见明确的选择，维护者也能独立调整它们。

| 区域 | 访客的问题 | 内容角色 |
| --- | --- | --- |
| 介绍 | 这里是什么？ | 说明主题 |
| 文章 | 我能读什么？ | 分享过程与观点 |
| 作品 | 做过什么？ | 展示可打开的成果 |

## 从一页开始

先选一篇文章和一件作品，检查卡片上的标题、摘要与目的地是否足够清楚，再逐步增加内容。这样的首页即使只有少量资料，也能保持完整。`,
    status: "PUBLISHED",
    firstPublishedAt: "2024-09-18T09:00:00.000Z",
    featured: true,
    tags: ["内容设计", "可访问性"],
  },
  {
    slug: "demo-searchable-archive",
    title: "A Small Search Index for a Bilingual Archive",
    excerpt: "A compact Markdown to text step makes mixed Chinese and English notes easier to find.",
    bodyLanguage: "en",
    body: `# Search should follow the words people read

A bilingual archive does not need two copies of every article. It needs one source of content and a search representation that keeps the visible words together.

## Store a plain text companion

The original Markdown remains the source of truth. At publication time, build a normalized search field from the title, excerpt, and body:

\`\`\`ts
const searchText = buildArticleSearchText({ title, excerpt, body });
\`\`\`

The helper keeps code and link labels, removes formatting marks and link targets, then folds whitespace. NFKC normalization also makes full width characters easier to match.

## Keep the first version small

A database substring query is enough for a personal archive with a modest number of posts. The content stays portable Markdown, while the index can be rebuilt from the source fields. If the archive grows beyond that shape, a dedicated search service can be evaluated with real query data.

For now, a useful result is one that answers a simple question: “Which note mentioned this idea?”`,
    status: "PUBLISHED",
    firstPublishedAt: "2025-02-12T09:00:00.000Z",
    featured: true,
    tags: ["工程实践", "Performance"],
  },
  {
    slug: "demo-project-detail-page",
    title: "让项目详情页像一份短说明书",
    excerpt: "用背景、取舍和结果组织项目正文，让作品卡片之后还有值得读的内容。",
    bodyLanguage: "zh",
    body: `# 让详情页补上卡片说不完的部分

作品卡片负责告诉访客“这是什么”。详情页可以再回答三个问题：它为什么开始、过程中做了哪些选择、现在可以怎样体验。

## 从使用情境写起

先描述遇到的具体摩擦，而不是先列技术栈。例如，一个阅读清单工具可能源于“稍后再读”的链接散落在聊天记录里。这个场景解释了功能出现的原因。

## 记录取舍

示例项目可以写下一个真实可讨论的约束：首版只保存链接和简短备注，因此不需要账户系统；列表优先显示标题和来源，方便快速扫读。好的说明不必把每个实现细节都变成卖点。

## 给正文留出呼吸

短段落、描述性标题和有意义的链接能让页面更容易浏览。Markdown 让写作者专注在内容结构，渲染层负责将结构变成一致的阅读体验。

详情页的目标不是把项目包装得更大，而是让它的边界、价值与状态都容易理解。`,
    status: "PUBLISHED",
    firstPublishedAt: "2025-10-07T09:00:00.000Z",
    featured: true,
    tags: ["工程实践", "Product Design"],
  },
  {
    slug: "demo-quiet-interface",
    title: "Notes on Shipping a Quiet Interface",
    excerpt: "A calm interface still needs strong hierarchy, useful feedback, and a clear next step.",
    bodyLanguage: "en",
    body: `# Quiet does not mean unclear

A restrained interface can be easy to overlook if every element has the same weight. Quiet design still depends on deliberate contrast: one primary action, readable supporting text, and enough space around important decisions.

## Make state visible

A form should explain what happened after someone saves it. A disabled button should not be the only sign that work is in progress. Small status messages, clear focus styles, and labels that remain visible make the interaction easier to follow.

## Test the content, too

The same layout should survive a short title, a long title, and a paragraph that wraps onto several lines. Try keyboard navigation and a narrow viewport before calling the design finished.

The goal is not less interface. It is less guesswork for the person using it.`,
    status: "PUBLISHED",
    firstPublishedAt: "2026-05-21T09:00:00.000Z",
    featured: false,
    tags: ["可访问性", "Product Design"],
  },
  {
    slug: "demo-weekly-interface-notes",
    title: "把一周的界面实验收进一份记录",
    excerpt: "草稿示例：把观察、假设和下一步放在一起，避免只留下最终截图。",
    bodyLanguage: "zh",
    body: `# 一周界面实验记录

> 演示草稿：这份内容用于展示未发布文章的后台状态。

## 观察

窄屏下的卡片标题容易挤占摘要空间。先记录出现问题的尺寸和内容长度，才能复现它。

## 假设

把类型和日期收进较轻的辅助信息，并限制摘要行数，可能会让标题重新成为视觉入口。

## 下一步

准备两组不同长度的内容，再通过键盘和触控各走一遍列表。完成检查之前，这篇草稿不会出现在公开文章列表。`,
    status: "DRAFT",
    firstPublishedAt: null,
    featured: false,
    tags: ["内容设计", "Prototyping"],
  },
  {
    slug: "demo-reading-queue-sketch",
    title: "Sketching a Reading Queue",
    excerpt: "Draft example: notes on the smallest useful shape of a private reading queue.",
    bodyLanguage: "en",
    body: `# Sketching a reading queue

> Demo draft: this entry shows how unpublished English content is stored.

The first version only needs three actions: add a link, mark it read, and remove it. A short note can explain why the link was saved. Search, folders, and reminders can wait until actual use shows a need.

A useful prototype should make the main loop testable without pretending the unfinished parts already exist.`,
    status: "DRAFT",
    firstPublishedAt: null,
    featured: false,
    tags: ["Prototyping", "Performance"],
  },
  {
    slug: "demo-component-rules",
    title: "从组件清单到视觉规则",
    excerpt: "撤下示例：保留曾经发布的内容与首次发布时间，但不再出现在公开页面。",
    bodyLanguage: "zh",
    body: `# 从组件清单到视觉规则

> 演示撤下文章：数据留在后台，公开地址不可访问。

单独列出按钮、输入框和卡片，并不能说明它们为何看起来属于同一个产品。比组件数量更重要的是规则：什么时候用强调色、层级如何变化、交互状态怎样保持一致。

把这些选择写清楚，后续页面就不必靠逐个复制来维持相似。`,
    status: "WITHDRAWN",
    firstPublishedAt: "2025-06-12T09:00:00.000Z",
    featured: false,
    tags: ["工程实践", "内容设计"],
  },
] as const;

const demoProjects = [
  {
    slug: "demo-field-notes",
    name: "Field Notes · 观察笔记",
    description: "一份把问题、假设和复盘放在同一条时间线上的研究记录示例。",
    type: "界面实验",
    bodyLanguage: "zh",
    body: `# Field Notes · 观察笔记

Field Notes 是一个用于整理产品观察的站内示例。每条记录包含发生情境、看到的摩擦和待验证的问题，避免把零散灵感直接当成结论。

## 为什么做

项目讨论常常从解决方案开始，却忘了说明问题发生在哪里。把观察和后续实验连在一起，可以让读者看见判断是怎样逐步形成的。

## 设计边界

首版只展示记录与标签，不模拟登录、协作或云端同步。访客可以从列表打开每条站内说明，了解一个小工具如何从清楚的范围开始。

## 目前状态

这是一个内容模型示例，正文使用 Markdown 编写，页面地址由固定 slug 组成。`,
    firstPublishedAt: "2025-01-14T09:00:00.000Z",
    featured: true,
  },
  {
    slug: "demo-reading-room",
    name: "Reading Room",
    description: "An on site concept for collecting links with the context that made them worth saving.",
    type: "开发工具",
    bodyLanguage: "en",
    body: `# Reading Room

Reading Room is a small on site project concept for keeping useful references together with the reason they were saved.

## The problem

Links often outlive the conversation where they were shared. When the context disappears, a bookmark becomes a pile of titles with no clear next step.

## A deliberately small first version

Each entry has a title, source, short note, and a read state. The project does not claim to store visitor accounts or sync data; this page is a demonstration of how a self contained project description can explain a product boundary.

## What to explore

The next design question is whether a compact list or a card layout makes saved context easier to scan.`,
    firstPublishedAt: "2025-07-03T09:00:00.000Z",
    featured: false,
  },
  {
    slug: "demo-interface-atlas",
    name: "Interface Atlas · 界面图谱",
    description: "收集不同页面中的层级、反馈与导航模式，作为可浏览的界面研究样例。",
    type: "开源项目",
    bodyLanguage: "zh",
    body: `# Interface Atlas · 界面图谱

Interface Atlas 把界面模式当作可以讨论的案例，而不是一份待复制的组件清单。

## 每个案例记录什么

- **情境**：用户当时想完成什么。
- **结构**：页面如何安排主要与辅助信息。
- **反馈**：操作之后发生了什么变化。
- **问题**：这个模式在不同内容长度下是否仍然清楚。

## 使用方式

浏览者可以沿着问题阅读案例，再把结论带回自己的设计。此处展示的是一个站内项目说明，不依赖外部账号或链接，也不代表已经提供完整产品服务。`,
    firstPublishedAt: "2026-02-18T09:00:00.000Z",
    featured: false,
  },
] as const;

function nextFeaturedRank(occupiedRanks: number[], limit: number) {
  if (occupiedRanks.length >= limit) return null;
  for (let rank = 1; rank <= limit; rank++) {
    if (!occupiedRanks.includes(rank)) return rank;
  }
  return null;
}

async function seedDemoContent() {
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      heroIntroduction: "此站点包含原创的中英文演示文章与作品，用于预览内容结构；样例不代表 Lawson 的真实经历。",
      contactUrl: null,
      socialLinks: [],
    },
    update: {},
  });

  const occupiedArticleRanks = (await prisma.article.findMany({
    where: { featuredRank: { not: null } },
    select: { featuredRank: true },
  })).flatMap(({ featuredRank }) => featuredRank === null ? [] : [featuredRank]);
  for (const article of demoArticles) {
    if (await prisma.article.findUnique({ where: { slug: article.slug } })) continue;

    const tags = [];
    for (const name of article.tags) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      tags.push({ id: tag.id });
    }

    const featuredRank = article.featured && article.status === "PUBLISHED"
      ? nextFeaturedRank(occupiedArticleRanks, 5)
      : null;
    if (featuredRank !== null) occupiedArticleRanks.push(featuredRank);
    await prisma.article.create({
      data: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        bodyLanguage: article.bodyLanguage,
        body: article.body,
        searchText: buildArticleSearchText(article),
        status: article.status,
        featuredRank,
        firstPublishedAt: article.firstPublishedAt ? new Date(article.firstPublishedAt) : null,
        tags: { connect: tags },
      },
    });
  }

  const occupiedProjectRanks = (await prisma.project.findMany({
    where: { featuredRank: { not: null } },
    select: { featuredRank: true },
  })).flatMap(({ featuredRank }) => featuredRank === null ? [] : [featuredRank]);
  for (const project of demoProjects) {
    if (await prisma.project.findUnique({ where: { slug: project.slug } })) continue;

    const featuredRank = project.featured
      ? nextFeaturedRank(occupiedProjectRanks, 3)
      : null;
    if (featuredRank !== null) occupiedProjectRanks.push(featuredRank);
    await prisma.project.create({
      data: {
        slug: project.slug,
        name: project.name,
        description: project.description,
        type: project.type,
        body: project.body,
        contentLanguage: project.bodyLanguage,
        cardTarget: "INTERNAL",
        status: "PUBLISHED",
        url: null,
        featuredRank,
        firstPublishedAt: new Date(project.firstPublishedAt),
      },
    });
  }

  console.log(`演示数据检查完成：${demoArticles.length} 篇文章、${demoProjects.length} 个站内作品（仅补充不存在的 slug）。`);
}

try {
  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      create: {
        ...project,
        firstPublishedAt: project.status === "PUBLISHED" ? new Date() : null,
      },
      update: {},
    });
  }

  if (process.argv.includes("--demo")) await seedDemoContent();
  console.log(`基础作品种子检查完成（${projects.length} 个固定 slug）。`);
} finally {
  await prisma.$disconnect();
}
