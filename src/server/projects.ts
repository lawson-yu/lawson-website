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

export async function getAdminProjects() {
  "use cache";

  cacheTag("projects");
  return getPrisma().project.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
}
