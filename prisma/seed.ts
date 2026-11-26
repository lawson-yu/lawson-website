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

try {
  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      create: {
        ...project,
        firstPublishedAt: project.status === "PUBLISHED" ? new Date() : null,
      },
      update: {
        name: project.name,
        description: project.description,
        type: project.type,
        cardTarget: project.cardTarget,
        status: project.status,
        url: project.url,
        featuredRank: project.featuredRank,
      },
    });
  }

  console.log(`已写入 ${projects.length} 条作品种子数据。`);
} finally {
  await prisma.$disconnect();
}
