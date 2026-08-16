-- AlterEnum
ALTER TYPE "FeatureFlagKey" ADD VALUE 'PAYMENT_GATEWAY_PAYOUTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WithdrawalStatus" ADD VALUE 'PAYOUT_PROCESSING';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'PAYOUT_FAILED';

-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN     "payoutFailureReason" TEXT,
ADD COLUMN     "payoutGatewayContactId" TEXT,
ADD COLUMN     "payoutGatewayFundAccountId" TEXT,
ADD COLUMN     "payoutGatewayPayoutId" TEXT,
ADD COLUMN     "payoutGatewayUtr" TEXT,
ADD COLUMN     "payoutInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "payoutInitiatedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_payoutGatewayPayoutId_key" ON "withdrawal_requests"("payoutGatewayPayoutId");

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_payoutInitiatedById_fkey" FOREIGN KEY ("payoutInitiatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
