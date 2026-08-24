-- CreateEnum
CREATE TYPE "DonationMode" AS ENUM ('CASH', 'UPI', 'BANK', 'CHEQUE');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "donationPointsPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "donationReceiptNumberFormat" TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}',
ADD COLUMN     "donationReceiptNumberPrefix" TEXT NOT NULL DEFAULT 'DON',
ADD COLUMN     "lastDonationReceiptSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "referral_points_ledger" ADD COLUMN     "relatedDonationId" TEXT;

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" "DonationMode" NOT NULL,
    "note" TEXT,
    "reference" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "receiptNumber" TEXT,
    "pointsAwarded" INTEGER,
    "recordedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donations_receiptNumber_key" ON "donations"("receiptNumber");

-- CreateIndex
CREATE INDEX "donations_organizationId_status_idx" ON "donations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "donations_memberId_status_idx" ON "donations"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_points_ledger_relatedDonationId_key" ON "referral_points_ledger"("relatedDonationId");

-- AddForeignKey
ALTER TABLE "referral_points_ledger" ADD CONSTRAINT "referral_points_ledger_relatedDonationId_fkey" FOREIGN KEY ("relatedDonationId") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
