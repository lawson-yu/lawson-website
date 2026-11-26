-- DropIndex
DROP INDEX "Project_featured_createdAt_idx";

-- DropColumn
ALTER TABLE "Project" DROP COLUMN "featured";
