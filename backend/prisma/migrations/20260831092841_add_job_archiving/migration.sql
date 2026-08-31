-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Job_isArchived_idx" ON "Job"("isArchived");
