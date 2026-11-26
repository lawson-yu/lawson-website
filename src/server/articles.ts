import "server-only";

import { cacheTag } from "next/cache";
import { getPrisma } from "./db";

export async function getPublishedArticles(tagId?: string, limit = 6) {
  "use cache";
  cacheTag("articles");

  return getPrisma().article.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: null },
      firstPublishedAt: { not: null },
      ...(tagId ? { tags: { some: { id: tagId } } } : {}),
    },
    orderBy: [{ firstPublishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
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
