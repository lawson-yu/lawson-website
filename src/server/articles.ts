import "server-only";

import { cacheTag } from "next/cache";
import {
  ARTICLE_BATCH_SIZE,
  MAX_ARTICLE_LIMIT,
  buildArticleSearchText,
  normalizeSearchQuery,
} from "@/lib/article-search";
import { getPrisma } from "./db";

export async function getPublishedArticles(
  tagId?: string,
  limit = ARTICLE_BATCH_SIZE,
  query?: string,
) {
  "use cache";
  cacheTag("articles");

  const prisma = getPrisma();
  const normalizedQuery = normalizeSearchQuery(query);
  const safeLimit = Math.min(Math.max(limit, ARTICLE_BATCH_SIZE), MAX_ARTICLE_LIMIT);

  if (normalizedQuery) {
    // 历史已发布文章若尚未生成搜索文本，首次检索时同步回填以保证可检索
    const missing = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        slug: { not: null },
        firstPublishedAt: { not: null },
        searchText: "",
      },
      select: { id: true, title: true, excerpt: true, body: true },
    });
    if (missing.length > 0) {
      await Promise.all(
        missing.map((article) => {
          const text = buildArticleSearchText(article);
          if (!text) return null;
          return prisma.article.update({
            where: { id: article.id },
            data: { searchText: text },
          });
        }),
      );
    }
  }

  return prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: null },
      firstPublishedAt: { not: null },
      ...(tagId ? { tags: { some: { id: tagId } } } : {}),
      ...(normalizedQuery
        ? { searchText: { contains: normalizedQuery, mode: "insensitive" } }
        : {}),
    },
    orderBy: [{ firstPublishedAt: "desc" }, { id: "desc" }],
    take: safeLimit + 1,
    include: { tags: true },
  });
}

export async function getPublishedTags() {
  "use cache";
  cacheTag("articles");

  return getPrisma().tag.findMany({
    where: {
      articles: {
        some: {
          status: "PUBLISHED",
          slug: { not: null },
          firstPublishedAt: { not: null },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getAdminTags() {
  "use cache";
  cacheTag("articles");

  return getPrisma().tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });
}

export async function getPublishedArticle(slug: string) {
  "use cache";
  cacheTag("articles", `article-${slug}`);

  return getPrisma().article.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      firstPublishedAt: { not: null },
    },
    include: { tags: true },
  });
}

export async function getAdminArticles() {
  "use cache";
  cacheTag("articles");

  return getPrisma().article.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}

export async function getAdminArticle(id: string) {
  "use cache";
  cacheTag("articles", `article-id-${id}`);

  return getPrisma().article.findUnique({ where: { id }, include: { tags: true } });
}

export async function isPublishedArticleSlug(slug: string) {
  const article = await getPrisma().article.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      firstPublishedAt: { not: null },
    },
    select: { id: true },
  });

  return Boolean(article);
}

export function getArticleImageUrl(key: string) {
  const baseUrl = process.env.MEDIA_BASE_URL;
  if (baseUrl) return new URL(key, baseUrl).toString();

  return `/uploads/${key.replace(/^\/+/, "")}`;
}
