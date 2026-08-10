-- RenameEnum (ReferralRank was a points-threshold "badge" tier; renamed to
-- VolunteerBatch to free up Silver/Gold/Platinum for the new MembershipPlan
-- tier concept without ambiguity)
ALTER TYPE "ReferralRank" RENAME TO "VolunteerBatch";

-- RenameColumn
ALTER TABLE "referral_rewards" RENAME COLUMN "rank" TO "batch";

-- RenameIndex
ALTER INDEX "referral_rewards_memberId_rank_key" RENAME TO "referral_rewards_memberId_batch_key";

-- RenameColumn (org_settings volunteer-batch thresholds — values preserved)
ALTER TABLE "org_settings" RENAME COLUMN "referralSilverMinPoints" TO "volunteerBatchSilverMinPoints";
ALTER TABLE "org_settings" RENAME COLUMN "referralGoldMinPoints" TO "volunteerBatchGoldMinPoints";
ALTER TABLE "org_settings" RENAME COLUMN "referralPlatinumMinPoints" TO "volunteerBatchPlatinumMinPoints";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "PointsLedgerStatus" AS ENUM ('PENDING', 'APPROVED', 'CONVERTED');

-- AlterTable (new plan tier — nullable, no backfill; existing plans fall back
-- to flat defaults until an admin assigns a tier)
ALTER TABLE "membership_plans" ADD COLUMN "tier" "PlanTier";

-- AlterTable (points ledger status — defaulted so every existing row backfills
-- to APPROVED, matching current behavior exactly)
ALTER TABLE "referral_points_ledger" ADD COLUMN "status" "PointsLedgerStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable (new referral matrix / conversion-ratio config)
ALTER TABLE "org_settings" ADD COLUMN "referralPointsCapPerMember" INTEGER,
ADD COLUMN "referralRequireActiveReferrerPlan" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pointsToMoneyRatioPoints" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "pointsToMoneyRatioAmount" DECIMAL(10,2) NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "event_reward_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_point_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referrerTier" "PlanTier" NOT NULL,
    "referredTier" "PlanTier" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_point_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_reward_rules_organizationId_idx" ON "event_reward_rules"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "event_reward_rules_eventId_tier_key" ON "event_reward_rules"("eventId", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "referral_point_rules_organizationId_referrerTier_referredT_key" ON "referral_point_rules"("organizationId", "referrerTier", "referredTier");

-- AddForeignKey
ALTER TABLE "event_reward_rules" ADD CONSTRAINT "event_reward_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reward_rules" ADD CONSTRAINT "event_reward_rules_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_point_rules" ADD CONSTRAINT "referral_point_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
