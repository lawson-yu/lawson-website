-- 创建作品表
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- 创建作品标识的唯一索引
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- 创建精选作品的时间排序索引
CREATE INDEX "Project_featured_createdAt_idx" ON "Project"("featured", "createdAt");
