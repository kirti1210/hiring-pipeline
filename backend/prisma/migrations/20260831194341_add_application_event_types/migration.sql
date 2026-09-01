/*
  Warnings:

  - The values [INTERVIEW_SCHEDULED,FEEDBACK_SUBMITTED] on the enum `ApplicationEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationEventType_new" AS ENUM ('APPLICATION_CREATED', 'STAGE_CHANGED', 'NOTE_ADDED', 'INTERVIEWER_ASSIGNED', 'INTERVIEWER_REMOVED', 'FEEDBACK_ADDED');
ALTER TABLE "ApplicationEvent" ALTER COLUMN "type" TYPE "ApplicationEventType_new" USING ("type"::text::"ApplicationEventType_new");
ALTER TYPE "ApplicationEventType" RENAME TO "ApplicationEventType_old";
ALTER TYPE "ApplicationEventType_new" RENAME TO "ApplicationEventType";
DROP TYPE "public"."ApplicationEventType_old";
COMMIT;
