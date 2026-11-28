import { isSiteOwner } from "@/lib/auth-policy";
import { getVisitorRecordCutoff } from "@/lib/visitor-retention";
import { getPrisma } from "@/server/db";

export const VISITOR_RECORDS_CACHE_TAG = "visitor-records";

export interface VisitorArticleVisitRecord {
  id: string;
  articleId: string;
  title: string;
  slug: string | null;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
  visitCount: number;
}

export interface VisitorProjectVisitRecord {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
  visitCount: number;
}

export interface VisitorRecordSummary {
  id: string;
  email: string;
  name: string;
  firstLoginAt: Date;
  lastLoginAt: Date;
  articleVisits: VisitorArticleVisitRecord[];
  projectVisits: VisitorProjectVisitRecord[];
}

export async function recordVisitorLogin(userId: string, loginAt = new Date()) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { firstLoginAt: true, lastLoginAt: true },
    });
    if (!existing) return;

    const firstLoginAt =
      !existing.firstLoginAt || loginAt < existing.firstLoginAt
        ? loginAt
        : existing.firstLoginAt;
    const lastLoginAt =
      !existing.lastLoginAt || loginAt > existing.lastLoginAt
        ? loginAt
        : existing.lastLoginAt;

    await tx.user.update({
      where: { id: userId },
      data: { firstLoginAt, lastLoginAt },
    });
  });
}

export async function recordArticleVisit(
  visitorId: string,
  articleId: string,
  visitedAt = new Date(),
): Promise<boolean> {
  if (!visitorId || !articleId) return false;
  const prisma = getPrisma();
  const article = await prisma.article.findFirst({
    where: { id: articleId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!article) return false;

  await prisma.articleVisit.upsert({
    where: { visitorId_articleId: { visitorId, articleId } },
    create: {
      visitorId,
      articleId,
      firstVisitedAt: visitedAt,
      lastVisitedAt: visitedAt,
      visitCount: 1,
    },
    update: {
      lastVisitedAt: visitedAt,
      visitCount: { increment: 1 },
    },
  });
  return true;
}

export async function recordProjectVisit(
  visitorId: string,
  projectId: string,
  visitedAt = new Date(),
): Promise<boolean> {
  if (!visitorId || !projectId) return false;
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      status: "PUBLISHED",
      body: { not: null },
      contentLanguage: { not: null },
    },
    select: { id: true },
  });
  if (!project) return false;

  await prisma.projectVisit.upsert({
    where: { visitorId_projectId: { visitorId, projectId } },
    create: {
      visitorId,
      projectId,
      firstVisitedAt: visitedAt,
      lastVisitedAt: visitedAt,
      visitCount: 1,
    },
    update: {
      lastVisitedAt: visitedAt,
      visitCount: { increment: 1 },
    },
  });
  return true;
}

export async function listVisitorRecords(): Promise<VisitorRecordSummary[]> {
  const users = await getPrisma().user.findMany({
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      createdAt: true,
      firstLoginAt: true,
      lastLoginAt: true,
      articleVisits: {
        orderBy: [{ lastVisitedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          articleId: true,
          firstVisitedAt: true,
          lastVisitedAt: true,
          visitCount: true,
          article: {
            select: { title: true, slug: true },
          },
        },
      },
      projectVisits: {
        orderBy: [{ lastVisitedAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          projectId: true,
          firstVisitedAt: true,
          lastVisitedAt: true,
          visitCount: true,
          project: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  });

  return users
    .filter((user) => !isSiteOwner(user.email, user.emailVerified))
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      firstLoginAt: user.firstLoginAt ?? user.createdAt,
      lastLoginAt: user.lastLoginAt ?? user.createdAt,
      articleVisits: user.articleVisits.map((visit) => ({
        id: visit.id,
        articleId: visit.articleId,
        title: visit.article.title,
        slug: visit.article.slug,
        firstVisitedAt: visit.firstVisitedAt,
        lastVisitedAt: visit.lastVisitedAt,
        visitCount: visit.visitCount,
      })),
      projectVisits: user.projectVisits.map((visit) => ({
        id: visit.id,
        projectId: visit.projectId,
        name: visit.project.name,
        slug: visit.project.slug,
        firstVisitedAt: visit.firstVisitedAt,
        lastVisitedAt: visit.lastVisitedAt,
        visitCount: visit.visitCount,
      })),
    }));
}

export async function pruneExpiredVisitorRecords(now = new Date()) {
  const cutoff = getVisitorRecordCutoff(now);
  const prisma = getPrisma();
  const [articleResult, projectResult] = await prisma.$transaction([
    prisma.articleVisit.deleteMany({
      where: { lastVisitedAt: { lt: cutoff } },
    }),
    prisma.projectVisit.deleteMany({
      where: { lastVisitedAt: { lt: cutoff } },
    }),
  ]);

  return {
    cutoff,
    deletedArticleVisits: articleResult.count,
    deletedProjectVisits: projectResult.count,
  };
}

export async function deleteVisitorAccount(
  visitorId: string,
  actingOwnerId: string,
): Promise<{ ok: true } | { ok: false; reason: "self" | "owner" | "not_found" }> {
  if (!visitorId) return { ok: false, reason: "not_found" };
  if (visitorId === actingOwnerId) return { ok: false, reason: "self" };

  const prisma = getPrisma();
  const visitor = await prisma.user.findUnique({
    where: { id: visitorId },
    select: { email: true, emailVerified: true },
  });
  if (!visitor) return { ok: false, reason: "not_found" };
  if (isSiteOwner(visitor.email, visitor.emailVerified)) return { ok: false, reason: "owner" };

  const deleted = await prisma.user.deleteMany({
    where: { id: visitorId },
  });
  if (deleted.count === 0) return { ok: false, reason: "not_found" };
  return { ok: true };
}
