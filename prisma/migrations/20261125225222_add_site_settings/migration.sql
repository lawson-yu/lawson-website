-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "heroIntroduction" TEXT,
    "contactUrl" TEXT,
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SiteSetting"
ADD CONSTRAINT "SiteSetting_singleton_id_check" CHECK ("id" = 1);
