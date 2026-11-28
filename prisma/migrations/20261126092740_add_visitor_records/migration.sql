-- AlterTable
ALTER TABLE "user" ADD COLUMN     "firstLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- 为已有账号回填首次与最近登录时间
UPDATE "user" AS u
SET
  "firstLoginAt" = COALESCE(
    (SELECT MIN(s."createdAt") FROM "session" AS s WHERE s."userId" = u."id"),
    u."createdAt"
  ),
  "lastLoginAt" = COALESCE(
    (SELECT MAX(s."createdAt") FROM "session" AS s WHERE s."userId" = u."id"),
    u."createdAt"
  )
WHERE u."firstLoginAt" IS NULL OR u."lastLoginAt" IS NULL;

-- CreateTable
CREATE TABLE "ArticleVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ArticleVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProjectVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleVisit_visitorId_lastVisitedAt_idx" ON "ArticleVisit"("visitorId", "lastVisitedAt");

-- CreateIndex
CREATE INDEX "ArticleVisit_lastVisitedAt_idx" ON "ArticleVisit"("lastVisitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVisit_visitorId_articleId_key" ON "ArticleVisit"("visitorId", "articleId");

-- CreateIndex
CREATE INDEX "ProjectVisit_visitorId_lastVisitedAt_idx" ON "ProjectVisit"("visitorId", "lastVisitedAt");

-- CreateIndex
CREATE INDEX "ProjectVisit_lastVisitedAt_idx" ON "ProjectVisit"("lastVisitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVisit_visitorId_projectId_key" ON "ProjectVisit"("visitorId", "projectId");

-- AddForeignKey
ALTER TABLE "ArticleVisit" ADD CONSTRAINT "ArticleVisit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleVisit" ADD CONSTRAINT "ArticleVisit_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVisit" ADD CONSTRAINT "ProjectVisit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVisit" ADD CONSTRAINT "ProjectVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
