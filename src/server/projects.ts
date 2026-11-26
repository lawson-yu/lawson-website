import "server-only";

import { cacheTag } from "next/cache";
import { getPrisma } from "./db";

export async function getPublishedProjects() {
  "use cache";

  cacheTag("projects");
  return getPrisma().project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ firstPublishedAt: "desc" }, { id: "asc" }],
  });
}

export async function getPublishedProjectSitemapEntries() {
  "use cache";
  cacheTag("projects");

  return getPrisma().project.findMany({
    where: {
      status: "PUBLISHED",
      cardTarget: "INTERNAL",
    },
    select: { slug: true, contentLanguage: true, updatedAt: true },
    orderBy: [{ firstPublishedAt: "desc" }],
  });
}

export async function getFeaturedProjects() {
  "use cache";

  cacheTag("projects");
  return getPrisma().project.findMany({
    where: {
      status: "PUBLISHED",
      firstPublishedAt: { not: null },
      featuredRank: { not: null },
    },
    orderBy: [{ featuredRank: "asc" }, { id: "asc" }],
    take: 3,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      type: true,
      cardTarget: true,
      url: true,
      coverImage: true,
      firstPublishedAt: true,
      createdAt: true,
    },
  });
}

export async function getPublishedProject(slug: string) {
  "use cache";

  cacheTag("projects");
  return getPrisma().project.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      cardTarget: "INTERNAL",
    },
  });
}

export async function isPublishedProjectSlug(slug: string) {
  const project = await getPrisma().project.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      cardTarget: "INTERNAL",
      body: { not: "" },
      contentLanguage: { not: "" },
    },
    select: { id: true },
  });

  return Boolean(project);
}

export async function getAdminProjects() {
  "use cache";

  cacheTag("projects");
  return getPrisma().project.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
}
