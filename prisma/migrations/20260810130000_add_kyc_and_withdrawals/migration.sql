-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK', 'UPI');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "WithdrawalChargeType" AS ENUM ('NONE', 'FLAT', 'PERCENTAGE');

-- AlterEnum
ALTER TYPE "ReferralLedgerReason" ADD VALUE 'WITHDRAWAL_CONVERTED';

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumberEncrypted" TEXT,
ADD COLUMN     "bankAccountNumberLast4" TEXT,
ADD COLUMN     "bankIfscCode" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "kycReviewNote" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycReviewedById" TEXT,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "payoutMethod" "PayoutMethod",
ADD COLUMN     "pointsConverted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWithdrawnAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "upiId" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "kycRequireAadhaar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kycRequireBankOrUpi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kycRequirePan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withdrawalChargeType" "WithdrawalChargeType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "withdrawalChargeValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "withdrawalFrequencyDays" INTEGER,
ADD COLUMN     "withdrawalMaxAmount" DECIMAL(10,2),
ADD COLUMN     "withdrawalMinAmount" DECIMAL(10,2) NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "referral_points_ledger" ADD COLUMN     "relatedWithdrawalRequestId" TEXT;

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "pointsRequested" INTEGER NOT NULL,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "chargeType" "WithdrawalChargeType" NOT NULL DEFAULT 'NONE',
    "chargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "payoutMethod" "PayoutMethod" NOT NULL,
    "payoutBankAccountName" TEXT,
    "payoutBankAccountNumberLast4" TEXT,
    "payoutBankIfscCode" TEXT,
    "payoutBankName" TEXT,
    "payoutUpiId" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_requests_organizationId_status_idx" ON "withdrawal_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "withdrawal_requests_memberId_status_idx" ON "withdrawal_requests"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_points_ledger_relatedWithdrawalRequestId_key" ON "referral_points_ledger"("relatedWithdrawalRequestId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_kycReviewedById_fkey" FOREIGN KEY ("kycReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_relatedWithdrawalRequestId_fkey" FOREIGN KEY ("relatedWithdrawalRequestId") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "referral_point_rules_organizationId_referrerTier_referredT_key" RENAME TO "referral_point_rules_organizationId_referrerTier_referredTi_key";

