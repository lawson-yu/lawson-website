"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { isContentLanguage } from "@/lib/content-language";
import { isValidSlug } from "@/lib/slug";
import { getFeaturedRankUpdates, type FeaturedIntent } from "@/lib/featured-rank";
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

async function publicationLabels() {
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });
  return {
    name: t("articleTitle"),
    description: t("projectDescription"),
    type: t("projectType"),
    validSlug: t("validProjectSlug"),
    validExternalCardTarget: t("validExternalCardTarget"),
    body: t("projectBody"),
    bodyLanguage: t("bodyLanguage"),
    validExternalUrl: t("validExternalUrl"),
  };
}

function publicationErrors(
  project: {
    name: string;
    description: string;
    type: string;
    slug: string;
    cardTarget: "INTERNAL" | "EXTERNAL";
    url: string | null;
    body: string | null;
    contentLanguage: string | null;
  },
  labels: { name: string; description: string; type: string; validSlug: string; validExternalCardTarget: string; body: string; bodyLanguage: string; validExternalUrl: string },
) {
  const errors: string[] = [];
  if (!project.name.trim()) errors.push(labels.name);
  if (!project.description.trim()) errors.push(labels.description);
  if (!project.type.trim()) errors.push(labels.type);
  if (!isValidSlug(project.slug)) errors.push(labels.validSlug);

  if (project.cardTarget === "EXTERNAL") {
    if (!project.url || !isWebUrl(project.url)) errors.push(labels.validExternalCardTarget);
  } else {
    if (!project.body?.trim()) errors.push(labels.body);
    if (!isContentLanguage(project.contentLanguage)) {
      errors.push(labels.bodyLanguage);
    }
    if (project.url && !isWebUrl(project.url)) errors.push(labels.validExternalUrl);
  }

  return errors;
}

async function projectActionError(error: unknown): Promise<ProjectActionState> {
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return { kind: "error", message: t("projectSlugTaken") };
  }
  return { kind: "error", message: t("projectSaveFailed") };
}

export async function saveProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  const labels = await publicationLabels();

  const id = readText(formData, "id").trim();
  const rawCardTarget = readText(formData, "cardTarget");
  const cardTarget = rawCardTarget === "INTERNAL"
    ? ProjectCardTarget.INTERNAL
    : rawCardTarget === "EXTERNAL"
      ? ProjectCardTarget.EXTERNAL
      : null;
  if (!cardTarget) {
    return { kind: "error", message: t("projectCardTargetInvalid") };
  }

  const prisma = getPrisma();
  const existing = id ? await prisma.project.findUnique({ where: { id } }) : null;
  if (id && !existing) return { kind: "error", message: t("projectNotFound") };

  const rawCoverImage = readText(formData, "coverImage").trim();
  const normalizedCoverImage = normalizeSubmittedMediaKey(rawCoverImage);
  if (rawCoverImage && !normalizedCoverImage) {
    return { kind: "error", message: t("invalidCoverPath") };
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
    }, labels);
    if (errors.length) {
      return { kind: "error", message: t("projectMissingFields", { fields: errors.join("、") }) };
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
    return { kind: "success", message: t("projectDraftSaved") };
  } catch (error) {
    return projectActionError(error);
  }
}

export async function publishProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  const labels = await publicationLabels();

  const id = readText(formData, "id").trim();
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { kind: "error", message: t("projectPublishNotFound") };

  const errors = publicationErrors(project, labels);
  if (errors.length) {
    return { kind: "error", message: t("projectPublishMissingFields", { fields: errors.join("、") }) };
  }

  const conflict = await prisma.project.findFirst({
    where: { slug: project.slug, id: { not: project.id } },
    select: { id: true },
  });
  if (conflict) return { kind: "error", message: t("projectRepublishSlugTaken") };

  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.project.findUnique({ where: { id: project.id } });
      if (!current) throw new Error("Project was deleted");
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
    return { kind: "success", message: t("projectPublished") };
  } catch (error) {
    return projectActionError(error);
  }
}

export async function withdrawProject(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });

  const id = readText(formData, "id").trim();
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { kind: "error", message: t("projectWithdrawNotFound") };
  if (project.status !== "PUBLISHED") {
    return { kind: "error", message: t("projectWithdrawOnlyPublished") };
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "WITHDRAWN" },
  });
  updateTag("projects");
  return { kind: "success", message: t("projectWithdrawn") };
}

export async function updateFeaturedProject(formData: FormData) {
  await requireSiteOwner();

  const id = readText(formData, "id").trim();
  const rawIntent = readText(formData, "intent").trim();
  if (!id || !["add", "remove", "up", "down"].includes(rawIntent)) return;

  const changed = await getPrisma().$transaction(async (transaction) => {
    const target = await transaction.project.findUnique({
      where: { id },
      select: { id: true, status: true, featuredRank: true },
    });
    if (!target) return false;

    const featured = await transaction.project.findMany({
      where: { status: { in: ["PUBLISHED", "WITHDRAWN"] }, featuredRank: { not: null } },
      orderBy: [{ featuredRank: "asc" }, { id: "asc" }],
      select: { id: true, status: true, featuredRank: true },
    });
    const updates = getFeaturedRankUpdates(
      featured,
      target,
      rawIntent as FeaturedIntent,
      3,
    );
    if (!updates) return false;

    for (const item of updates.updates) {
      await transaction.project.update({
        where: { id: item.id },
        data: { featuredRank: item.featuredRank },
      });
    }
    if (updates.clearId) {
      await transaction.project.update({
        where: { id: updates.clearId },
        data: { featuredRank: null },
      });
    }
    return true;
  }, { isolationLevel: "Serializable" });

  if (changed) updateTag("projects");
}
