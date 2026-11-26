"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
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
    tagIds?: string[];
  };
};

function value(formData: FormData, name: string) {
  const result = formData.get(name);
  return typeof result === "string" ? result.trim() : "";
}

function searchText(title: string, excerpt: string, body: string) {
  const plainBody = body
    .replace(/^\s*(```|~~~)[^\n]*\n?/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${title} ${excerpt} ${plainBody}`.normalize("NFKC").trim();
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getMissingFields(values: ArticleActionState["values"], slug: string) {
  const missing: string[] = [];
  if (!values.title) missing.push("标题");
  if (!values.excerpt) missing.push("摘要");
  if (values.bodyLanguage !== "zh" && values.bodyLanguage !== "en") missing.push("正文语言");
  if (!values.body) missing.push("正文");
  if (!slug) missing.push("文章网址");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) missing.push("有效的文章网址");
  return missing;
}

export async function saveArticle(
  previousState: ArticleActionState,
  formData: FormData,
): Promise<ArticleActionState> {
  await requireSiteOwner();

  const id = value(formData, "articleId");
  const intent = value(formData, "intent");
  const values = {
    title: value(formData, "title"),
    excerpt: value(formData, "excerpt"),
    bodyLanguage: value(formData, "bodyLanguage"),
    body: value(formData, "body"),
    slug: value(formData, "slug"),
    tagIds: [...new Set(formData.getAll("tagIds")
      .filter((item): item is string => typeof item === "string")
      .map((id) => id.trim())
      .filter(Boolean))],
  };
  if (!["save", "publish", "withdraw"].includes(intent)) {
    return { revision: previousState.revision + 1, message: "操作无效，请重新提交。", values };
  }

  const prisma = getPrisma();
  const existing = id ? await prisma.article.findUnique({ where: { id } }) : null;
  if (id && !existing) {
    return { revision: previousState.revision + 1, message: "找不到这篇文章。", values };
  }

  if (intent === "withdraw") {
    if (existing?.status !== "PUBLISHED") {
      return { revision: previousState.revision + 1, message: "只有已发布的文章可以撤下。", values };
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
      message: "标签已变化，请刷新页面后重试。",
      values,
    };
  }

  const slug = existing?.slug ?? values.slug;
  const requiredFields = intent === "publish" || existing?.status === "PUBLISHED"
    ? getMissingFields(values, slug)
    : [];
  if (requiredFields.length) {
    return {
      revision: previousState.revision + 1,
      message: `请先补齐：${requiredFields.join("、")}`,
      missing: requiredFields,
      values,
    };
  }

  if (existing && existing.slug && values.slug && values.slug !== existing.slug) {
    return {
      revision: previousState.revision + 1,
      message: "文章发布后网址固定，不能修改。",
      values,
    };
  }

  const data = {
    title: values.title,
    excerpt: values.excerpt,
    bodyLanguage: values.bodyLanguage || null,
    body: values.body,
    searchText: searchText(values.title, values.excerpt, values.body),
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
        message: "这个网址已被其他文章使用，请换一个。",
        values,
      };
    }
    throw error;
  }
}
