-- CreateEnum
CREATE TYPE "ProjectCardTarget" AS ENUM ('INTERNAL', 'EXTERNAL');

-- 在移除旧精选标记前补全已有作品记录。
ALTER TABLE "Project"
ADD COLUMN     "body" TEXT,
ADD COLUMN     "cardTarget" "ProjectCardTarget" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "contentLanguage" TEXT,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "featuredRank" INTEGER,
ADD COLUMN     "firstPublishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT '';

UPDATE "Project"
SET "type" = '项目',
    "cardTarget" = CASE
      WHEN "url" ~* '^https?://[^[:space:]]+' THEN 'EXTERNAL'::"ProjectCardTarget"
      ELSE 'INTERNAL'::"ProjectCardTarget"
    END,
    "status" = CASE
      WHEN "url" ~* '^https?://[^[:space:]]+' THEN 'PUBLISHED'::"ContentStatus"
      ELSE 'DRAFT'::"ContentStatus"
    END,
    "firstPublishedAt" = CASE
      WHEN "url" ~* '^https?://[^[:space:]]+' THEN "createdAt"
      ELSE NULL
    END;

WITH featured_projects AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" DESC, "id" ASC)::INTEGER AS rank
  FROM "Project"
  WHERE "featured" = true
)
UPDATE "Project" AS project
SET "featuredRank" = featured_projects.rank
FROM featured_projects
WHERE project."id" = featured_projects."id";

-- CreateIndex
CREATE INDEX "Project_status_firstPublishedAt_idx" ON "Project"("status", "firstPublishedAt");

-- CreateIndex
CREATE INDEX "Project_featuredRank_idx" ON "Project"("featuredRank");
