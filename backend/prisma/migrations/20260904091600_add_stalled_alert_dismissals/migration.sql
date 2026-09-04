/*
  Warnings:

  - A unique constraint covering the columns `[userId,applicationId,stage]` on the table `AlertDismissal` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `applicationId` to the `AlertDismissal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stage` to the `AlertDismissal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AlertDismissal" ADD COLUMN     "applicationId" UUID NOT NULL,
ADD COLUMN     "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "stage" "ApplicationStage" NOT NULL;

-- CreateIndex
CREATE INDEX "AlertDismissal_applicationId_idx" ON "AlertDismissal"("applicationId");

-- CreateIndex
CREATE INDEX "AlertDismissal_stage_idx" ON "AlertDismissal"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDismissal_userId_applicationId_stage_key" ON "AlertDismissal"("userId", "applicationId", "stage");

-- AddForeignKey
ALTER TABLE "AlertDismissal" ADD CONSTRAINT "AlertDismissal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
