-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankName" TEXT,
    "membershipNumberFormat" TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}',
    "receiptNumberFormat" TEXT NOT NULL DEFAULT 'RCPT-{YYYY}-{SEQ}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_organizationId_key" ON "org_settings"("organizationId");

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
