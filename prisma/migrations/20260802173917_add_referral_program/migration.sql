-- CreateEnum
CREATE TYPE "ReferralLedgerReason" AS ENUM ('REFERRAL_APPROVED', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReferralRank" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'FULFILLED');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralPointsBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "pointsPerApprovedReferral" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "referralGoldMinPoints" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "referralPlatinumMinPoints" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "referralProgramEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralSilverMinPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "referral_points_ledger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" "ReferralLedgerReason" NOT NULL,
    "relatedMemberId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rank" "ReferralRank" NOT NULL,
    "pointsAtEarn" INTEGER NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_points_ledger_organizationId_memberId_idx" ON "referral_points_ledger"("organizationId", "memberId");

-- CreateIndex
CREATE INDEX "referral_rewards_organizationId_status_idx" ON "referral_rewards"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_memberId_rank_key" ON "referral_rewards"("memberId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "members_referralCode_key" ON "members"("referralCode");

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_relatedMemberId_fkey" FOREIGN KEY ("relatedMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

