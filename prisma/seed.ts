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
    url: "https://example.com",
    featured: true,
  },
  {
    slug: "open-source-tool",
    name: "开源工具",
    description: "记录一个开源工具项目的简介与访问入口。",
    url: "https://github.com/example",
    featured: true,
  },
  {
    slug: "side-project",
    name: "实验性小项目",
    description: "用于展示个人实践与实验成果的示例条目。",
    url: null,
    featured: false,
  },
];

try {
  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      create: project,
      update: {
        name: project.name,
        description: project.description,
        url: project.url,
        featured: project.featured,
      },
    });
  }

  console.log(`已写入 ${projects.length} 条作品种子数据。`);
} finally {
  await prisma.$disconnect();
}
