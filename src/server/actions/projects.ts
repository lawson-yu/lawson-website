"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { ProjectCardTarget } from "@/generated/prisma/client";
import { normalizeSubmittedMediaKey } from "@/lib/media-url";
import { getPrisma } from "@/server/db";
import { requireSiteOwner } from "@/server/auth";

export type ProjectActionState = {
  kind: "error" | "success";
  message: string;
} | null;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function publicationErrors(project: {
  name: string;
  description: string;
  type: string;
  slug: string;
  cardTarget: "INTERNAL" | "EXTERNAL";
  url: string | null;
  body: string | null;
  contentLanguage: string | null;
}) {
  const errors: string[] = [];
  if (!project.name.trim()) errors.push("标题");
  if (!project.description.trim()) errors.push("简介");
  if (!project.type.trim()) errors.push("类型");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) errors.push("有效的作品地址");

  if (project.cardTarget === "EXTERNAL") {
    if (!project.url || !isWebUrl(project.url)) errors.push("有效的外部卡片入口");
  } else {
    if (!project.body?.trim()) errors.push("项目正文");
    if (project.contentLanguage !== "zh" && project.contentLanguage !== "en") {
      errors.push("正文语言");
    }
    if (project.url && !isWebUrl(project.url)) errors.push("有效的外部访问入口");
  }

  return errors;
}

function projectActionError(error: unknown): ProjectActionState {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return { kind: "error", message: "这个作品地址已被使用，请更换后再保存或发布。" };
  }
  return { kind: "error", message: "保存失败，请稍后重试。" };
}

export async function saveProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();

  const id = readText(formData, "id").trim();
  const rawCardTarget = readText(formData, "cardTarget");
  const cardTarget = rawCardTarget === "INTERNAL"
    ? ProjectCardTarget.INTERNAL
    : rawCardTarget === "EXTERNAL"
      ? ProjectCardTarget.EXTERNAL
      : null;
  if (!cardTarget) {
    return { kind: "error", message: "请选择有效的卡片主入口。" };
  }

  const prisma = getPrisma();
  const existing = id ? await prisma.project.findUnique({ where: { id } }) : null;
  if (id && !existing) return { kind: "error", message: "找不到要编辑的作品，请刷新后重试。" };

  const rawCoverImage = readText(formData, "coverImage").trim();
  const normalizedCoverImage = normalizeSubmittedMediaKey(rawCoverImage);
  if (rawCoverImage && !normalizedCoverImage) {
    return { kind: "error", message: "封面路径格式无效，请通过上传按钮上传或填写合法的相对媒体路径。" };
  }

  const submittedSlug = readText(formData, "slug").trim();
  const slug = existing?.firstPublishedAt
    ? existing.slug
    : submittedSlug || existing?.slug || `draft-${randomUUID().slice(0, 12)}`;
  const data = {
    slug,
    name: readText(formData, "name").trim(),
    description: readText(formData, "description").trim(),
    type: readText(formData, "type").trim(),
    cardTarget,
    url: readText(formData, "url").trim() || null,
    coverImage: normalizedCoverImage,
    body: readText(formData, "body") || null,
    contentLanguage: readText(formData, "contentLanguage").trim() || null,
  };

  if (existing?.status === "PUBLISHED") {
    const errors = publicationErrors({
      ...data,
      cardTarget: data.cardTarget as "INTERNAL" | "EXTERNAL",
    });
    if (errors.length) {
      return { kind: "error", message: `更新公开作品前请补齐：${errors.join("、")}。` };
    }
  }

  try {
    if (existing) {
      await prisma.project.update({
        where: { id },
        data: {
          ...data,
          ...(existing.firstPublishedAt ? { slug: existing.slug } : {}),
        },
      });
    } else {
      await prisma.project.create({ data });
    }
    updateTag("projects");
    return { kind: "success", message: "作品草稿已保存。" };
  } catch (error) {
    return projectActionError(error);
  }
}

export async function publishProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();

  const id = readText(formData, "id").trim();
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { kind: "error", message: "找不到要发布的作品，请刷新后重试。" };

  const errors = publicationErrors(project);
  if (errors.length) {
    return { kind: "error", message: `发布前请补齐：${errors.join("、")}。` };
  }

  const conflict = await prisma.project.findFirst({
    where: { slug: project.slug, id: { not: project.id } },
    select: { id: true },
  });
  if (conflict) return { kind: "error", message: "这个作品地址已被使用，请更换后再发布。" };

  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.project.findUnique({ where: { id: project.id } });
      if (!current) throw new Error("作品已被删除");
      if (current.firstPublishedAt) {
        await transaction.project.update({
          where: { id: current.id },
          data: { status: "PUBLISHED" },
        });
        return;
      }

      const claimed = await transaction.project.updateMany({
        where: { id: current.id, firstPublishedAt: null },
        data: {
          slug: project.slug,
          status: "PUBLISHED",
          firstPublishedAt: new Date(),
        },
      });
      if (!claimed.count) {
        await transaction.project.update({
          where: { id: current.id },
          data: { status: "PUBLISHED" },
        });
      }
    });
    updateTag("projects");
    return { kind: "success", message: "作品已发布，首次发布时间和地址已固定。" };
  } catch (error) {
    return projectActionError(error);
  }
}

export async function withdrawProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();

  const id = readText(formData, "id").trim();
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { kind: "error", message: "找不到要撤下的作品，请刷新后重试。" };
  if (project.status !== "PUBLISHED") {
    return { kind: "error", message: "只有已发布作品可以撤下。" };
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "WITHDRAWN" },
  });
  updateTag("projects");
  return { kind: "success", message: "作品已撤下，公开入口已关闭。" };
}
