-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "gatewayOrderId" TEXT,
ADD COLUMN     "gatewayPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "donations_gatewayPaymentId_key" ON "donations"("gatewayPaymentId");
