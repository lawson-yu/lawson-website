"use server";

import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { buildArticleSearchText } from "@/lib/article-search";
import { normalizeSubmittedMediaKey } from "@/lib/media-url";
import { isContentLanguage } from "@/lib/content-language";
import { isValidSlug } from "@/lib/slug";
import { getFeaturedRankUpdates, type FeaturedIntent } from "@/lib/featured-rank";
import { getPrisma } from "./db";
import { requireSiteOwner } from "./auth";

export type ArticleActionState = {
  revision: number;
  message?: string;
  missing?: string[];
  values: {
    title?: string;
    excerpt?: string;
    bodyLanguage?: string;
    body?: string;
    slug?: string;
    coverImageKey?: string;
    tagIds?: string[];
  };
};

function value(formData: FormData, name: string) {
  const result = formData.get(name);
  return typeof result === "string" ? result.trim() : "";
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getMissingFields(
  values: ArticleActionState["values"],
  slug: string,
  labels: { title: string; excerpt: string; bodyLanguage: string; body: string; slug: string; validSlug: string },
) {
  const missing: string[] = [];
  if (!values.title) missing.push(labels.title);
  if (!values.excerpt) missing.push(labels.excerpt);
  if (!isContentLanguage(values.bodyLanguage)) missing.push(labels.bodyLanguage);
  if (!values.body) missing.push(labels.body);
  if (!slug) missing.push(labels.slug);
  else if (!isValidSlug(slug) || slug.length > 120) missing.push(labels.validSlug);
  return missing;
}

export async function saveArticle(
  previousState: ArticleActionState,
  formData: FormData,
): Promise<ArticleActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  const adminT = await getTranslations({ locale: "zh", namespace: "Admin" });

  const id = value(formData, "articleId");
  const intent = value(formData, "intent");
  const values = {
    title: value(formData, "title"),
    excerpt: value(formData, "excerpt"),
    bodyLanguage: value(formData, "bodyLanguage"),
    body: value(formData, "body"),
    slug: value(formData, "slug"),
    coverImageKey: value(formData, "coverImageKey"),
    tagIds: [...new Set(formData.getAll("tagIds")
      .filter((item): item is string => typeof item === "string")
      .map((id) => id.trim())
      .filter(Boolean))],
  };
  if (!["save", "publish", "withdraw"].includes(intent)) {
    return { revision: previousState.revision + 1, message: t("articleOperationInvalid"), values };
  }

  const prisma = getPrisma();
  const existing = id ? await prisma.article.findUnique({ where: { id } }) : null;
  if (id && !existing) {
    return { revision: previousState.revision + 1, message: t("articleNotFound"), values };
  }

  if (intent === "withdraw") {
    if (existing?.status !== "PUBLISHED") {
      return { revision: previousState.revision + 1, message: t("articleWithdrawOnlyPublished"), values };
    }
    await prisma.article.update({ where: { id }, data: { status: "WITHDRAWN" } });
    updateTag("articles");
    updateTag(`article-${existing.slug}`);
    updateTag(`article-id-${existing.id}`);
    redirect(`/admin/articles/${existing.id}`);
  }

  const validTagCount = await prisma.tag.count({ where: { id: { in: values.tagIds } } });
  if (validTagCount !== values.tagIds.length) {
    return {
      revision: previousState.revision + 1,
      message: t("articleTagsChanged"),
      values,
    };
  }

  const slug = existing?.slug ?? values.slug;
  const requiredFields = intent === "publish" || existing?.status === "PUBLISHED"
    ? getMissingFields(values, slug, {
        title: adminT("articleTitle"),
        excerpt: adminT("articleExcerpt"),
        bodyLanguage: adminT("bodyLanguage"),
        body: adminT("articleBody"),
        slug: adminT("articleSlug"),
        validSlug: adminT("validArticleSlug"),
      })
    : [];
  if (requiredFields.length) {
    return {
      revision: previousState.revision + 1,
      message: t("articleMissingFields", { fields: requiredFields.join("、") }),
      missing: requiredFields,
      values,
    };
  }

  if (existing && existing.slug && values.slug && values.slug !== existing.slug) {
    return {
      revision: previousState.revision + 1,
      message: t("articleSlugFixed"),
      values,
    };
  }

  const normalizedCoverImageKey = normalizeSubmittedMediaKey(values.coverImageKey);
  if (values.coverImageKey && !normalizedCoverImageKey) {
    return {
      revision: previousState.revision + 1,
      message: t("invalidCoverPath"),
      values,
    };
  }

  const data = {
    title: values.title,
    excerpt: values.excerpt,
    bodyLanguage: values.bodyLanguage || null,
    body: values.body,
    coverImageKey: normalizedCoverImageKey,
    searchText: buildArticleSearchText(values),
    ...(intent === "publish"
      ? {
          slug,
          status: "PUBLISHED" as const,
          firstPublishedAt: existing?.firstPublishedAt ?? new Date(),
        }
      : {}),
  };

  try {
    const article = existing
      ? await prisma.article.update({
          where: { id: existing.id },
          data: { ...data, tags: { set: values.tagIds.map((id) => ({ id })) } },
        })
      : await prisma.article.create({
          data: { ...data, tags: { connect: values.tagIds.map((id) => ({ id })) } },
        });
    updateTag("articles");
    updateTag(`article-id-${article.id}`);
    if (existing?.slug) updateTag(`article-${existing.slug}`);
    if (article.slug) updateTag(`article-${article.slug}`);
    redirect(`/admin/articles/${article.id}`);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        revision: previousState.revision + 1,
        message: t("articleSlugTaken"),
        values,
      };
    }
    throw error;
  }
}

export async function updateFeaturedArticle(formData: FormData) {
  await requireSiteOwner();

  const id = value(formData, "id");
  const rawIntent = value(formData, "intent");
  if (!id || !["add", "remove", "up", "down"].includes(rawIntent)) return;

  const changed = await getPrisma().$transaction(async (transaction) => {
    const target = await transaction.article.findUnique({
      where: { id },
      select: { id: true, status: true, featuredRank: true },
    });
    if (!target) return false;

    const featured = await transaction.article.findMany({
      where: { status: { in: ["PUBLISHED", "WITHDRAWN"] }, featuredRank: { not: null } },
      orderBy: [{ featuredRank: "asc" }, { id: "asc" }],
      select: { id: true, status: true, featuredRank: true },
    });
    const updates = getFeaturedRankUpdates(
      featured,
      target,
      rawIntent as FeaturedIntent,
      5,
    );
    if (!updates) return false;

    for (const item of updates.updates) {
      await transaction.article.update({
        where: { id: item.id },
        data: { featuredRank: item.featuredRank },
      });
    }
    if (updates.clearId) {
      await transaction.article.update({
        where: { id: updates.clearId },
        data: { featuredRank: null },
      });
    }
    return true;
  }, { isolationLevel: "Serializable" });

  if (changed) updateTag("articles");
}
