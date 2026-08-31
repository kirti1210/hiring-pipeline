/*
  Warnings:

  - You are about to drop the column `alertKey` on the `AlertDismissal` table. All the data in the column will be lost.
  - You are about to drop the column `dismissedAt` on the `AlertDismissal` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AlertDismissal_userId_alertKey_key";

-- AlterTable
ALTER TABLE "AlertDismissal" DROP COLUMN "alertKey",
DROP COLUMN "dismissedAt";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source" TEXT;
