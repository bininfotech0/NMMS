-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "gatewayOrderId" TEXT,
ADD COLUMN     "gatewayPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");
