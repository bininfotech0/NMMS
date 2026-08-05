-- CreateEnum
CREATE TYPE "InterestArea" AS ENUM ('EDUCATION', 'HEALTH', 'ENVIRONMENT', 'WOMEN_EMPOWERMENT', 'CHILD_WELFARE', 'SKILL_DEVELOPMENT', 'AGRICULTURE', 'RURAL_DEVELOPMENT', 'SPORTS', 'DISASTER_RELIEF', 'DIGITAL_LITERACY', 'FUND_RAISING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'SIGNATURE';
ALTER TYPE "DocumentType" ADD VALUE 'AADHAAR_FRONT';
ALTER TYPE "DocumentType" ADD VALUE 'AADHAAR_BACK';
ALTER TYPE "DocumentType" ADD VALUE 'QUALIFICATION_CERTIFICATE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LookupCategory" ADD VALUE 'RELIGION';
ALTER TYPE "LookupCategory" ADD VALUE 'CASTE_CATEGORY';
ALTER TYPE "LookupCategory" ADD VALUE 'BUSINESS_TYPE';
ALTER TYPE "LookupCategory" ADD VALUE 'MEMBERSHIP_CATEGORY';
ALTER TYPE "LookupCategory" ADD VALUE 'BRANCH';

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "businessTypeId" TEXT,
ADD COLUMN     "casteCategoryId" TEXT,
ADD COLUMN     "declarationAcceptConstitution" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declarationAcceptPrivacyPolicy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declarationAcceptTerms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declarationDate" TIMESTAMP(3),
ADD COLUMN     "declarationInfoCorrect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declarationPlace" TEXT,
ADD COLUMN     "drivingLicenceNumber" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "interestAreas" "InterestArea"[],
ADD COLUMN     "interestedAsVolunteer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipCategoryId" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "permAddressLine" TEXT,
ADD COLUMN     "permBlockId" TEXT,
ADD COLUMN     "permDistrictId" TEXT,
ADD COLUMN     "permPanchayatId" TEXT,
ADD COLUMN     "permPincode" TEXT,
ADD COLUMN     "permStateId" TEXT,
ADD COLUMN     "permVillageId" TEXT,
ADD COLUMN     "qualificationDetail" TEXT,
ADD COLUMN     "referralMemberId" TEXT,
ADD COLUMN     "religionId" TEXT,
ADD COLUMN     "sameAsCurrentAddress" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "nominees" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "dob" TIMESTAMP(3),
    "address" TEXT,
    "mobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nominees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nominees_memberId_key" ON "nominees"("memberId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_permStateId_fkey" FOREIGN KEY ("permStateId") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_permDistrictId_fkey" FOREIGN KEY ("permDistrictId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_permBlockId_fkey" FOREIGN KEY ("permBlockId") REFERENCES "blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_permPanchayatId_fkey" FOREIGN KEY ("permPanchayatId") REFERENCES "panchayats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_permVillageId_fkey" FOREIGN KEY ("permVillageId") REFERENCES "villages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_religionId_fkey" FOREIGN KEY ("religionId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_casteCategoryId_fkey" FOREIGN KEY ("casteCategoryId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_membershipCategoryId_fkey" FOREIGN KEY ("membershipCategoryId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_referralMemberId_fkey" FOREIGN KEY ("referralMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
