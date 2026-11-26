import "server-only";

import { cacheTag } from "next/cache";
import {
  ARTICLE_BATCH_SIZE,
  MAX_ARTICLE_LIMIT,
  buildArticleSearchText,
  normalizeSearchQuery,
} from "@/lib/article-search";
import { resolveMediaUrl } from "@/lib/media-url";
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

  const where = {
    status: "PUBLISHED" as const,
    slug: { not: null },
    firstPublishedAt: { not: null },
    ...(tagId ? { tags: { some: { id: tagId } } } : {}),
  };
  const orderBy = [{ firstPublishedAt: "desc" as const }, { id: "desc" as const }];
  const take = safeLimit + 1;

  if (!normalizedQuery) {
    return prisma.article.findMany({ where, orderBy, take, include: { tags: true } });
  }

  const [indexedArticles, legacyArticles] = await Promise.all([
    prisma.article.findMany({
      where: { ...where, searchText: { contains: normalizedQuery, mode: "insensitive" } },
      orderBy,
      take,
      include: { tags: true },
    }),
    prisma.article.findMany({
      where: { ...where, searchText: "" },
      include: { tags: true },
    }),
  ]);

  // shortcut: legacy articles are scanned for each new query; add a deploy-time backfill if volume makes this expensive.
  return [
    ...indexedArticles,
    ...legacyArticles.filter((article) =>
      buildArticleSearchText(article).toLowerCase().includes(normalizedQuery.toLowerCase()),
    ),
  ]
    .sort((left, right) =>
      right.firstPublishedAt!.getTime() - left.firstPublishedAt!.getTime() ||
      (left.id > right.id ? -1 : left.id < right.id ? 1 : 0),
    )
    .slice(0, take);
}

export async function getFeaturedArticles() {
  "use cache";
  cacheTag("articles");

  return getPrisma().article.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: null },
      firstPublishedAt: { not: null },
      featuredRank: { not: null },
    },
    orderBy: [{ featuredRank: "asc" }, { id: "asc" }],
    take: 5,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImageKey: true,
      firstPublishedAt: true,
      createdAt: true,
      tags: { select: { id: true, name: true } },
    },
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
      bodyLanguage: { not: "" },
    },
    select: { id: true },
  });

  return Boolean(article);
}

export function getArticleImageUrl(key: string | null | undefined) {
  return resolveMediaUrl(key) ?? "";
}
