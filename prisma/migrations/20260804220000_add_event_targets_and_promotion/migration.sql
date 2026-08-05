-- CreateEnum
CREATE TYPE "EventCompletionStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ReferralLedgerReason" ADD VALUE 'EVENT_TARGET_COMPLETED';

-- AlterTable
ALTER TABLE "event_registrations" ADD COLUMN     "completionStatus" "EventCompletionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "evidenceFileName" TEXT,
ADD COLUMN     "evidenceFilePath" TEXT,
ADD COLUMN     "evidenceMimeType" TEXT,
ADD COLUMN     "evidenceNote" TEXT,
ADD COLUMN     "evidenceSizeBytes" INTEGER,
ADD COLUMN     "quantityAchieved" INTEGER,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "pointsReward" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetDescription" TEXT,
ADD COLUMN     "targetQuantity" INTEGER;

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "promotedToUserId" TEXT,
ADD COLUMN     "selfRegistered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "referral_points_ledger" ADD COLUMN     "relatedEventRegistrationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "members_promotedToUserId_key" ON "members"("promotedToUserId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_promotedToUserId_fkey" FOREIGN KEY ("promotedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_relatedEventRegistrationId_fkey" FOREIGN KEY ("relatedEventRegistrationId") REFERENCES "event_registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

