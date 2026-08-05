-- CreateEnum
CREATE TYPE "RegistrationMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "IdentityEntryMethod" AS ENUM ('AUTO_FILL', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'PASSPORT';
ALTER TYPE "DocumentType" ADD VALUE 'DRIVING_LICENCE';
ALTER TYPE "DocumentType" ADD VALUE 'GOVERNMENT_ID';

-- AlterEnum
ALTER TYPE "LookupCategory" ADD VALUE 'FAMILY_TYPE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemberStatus" ADD VALUE 'PAYMENT_COLLECTED';
ALTER TYPE "MemberStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "MemberStatus" ADD VALUE 'DECEASED';

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "familyTypeId" TEXT,
ADD COLUMN     "identityEntryMethod" "IdentityEntryMethod",
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "monthlyIncome" DECIMAL(10,2),
ADD COLUMN     "permLandmark" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3),
ADD COLUMN     "registrationLatitude" DOUBLE PRECISION,
ADD COLUMN     "registrationLongitude" DOUBLE PRECISION,
ADD COLUMN     "registrationMode" "RegistrationMode" DEFAULT 'ONLINE',
ADD COLUMN     "registrationNumber" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "lastRegistrationSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationNumberFormat" TEXT NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}',
ADD COLUMN     "registrationNumberPrefix" TEXT NOT NULL DEFAULT 'REG';

-- CreateIndex
CREATE UNIQUE INDEX "members_registrationNumber_key" ON "members"("registrationNumber");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_familyTypeId_fkey" FOREIGN KEY ("familyTypeId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

