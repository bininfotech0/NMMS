-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'ACTIVE', 'REJECTED', 'EXPIRED', 'RENEWED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED');

-- CreateTable
CREATE TABLE "panchayats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "panchayats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "villages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "panchayatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipNumber" TEXT,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "bloodGroup" TEXT,
    "mobile" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "emergencyContact" TEXT,
    "stateId" TEXT,
    "districtId" TEXT,
    "blockId" TEXT,
    "panchayatId" TEXT,
    "villageId" TEXT,
    "pincode" TEXT,
    "addressLine" TEXT,
    "aadhaarLast4" TEXT,
    "aadhaarHash" TEXT,
    "pan" TEXT,
    "voterId" TEXT,
    "educationId" TEXT,
    "occupationId" TEXT,
    "planId" TEXT,
    "joiningDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "MemberStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "panchayats_blockId_name_key" ON "panchayats"("blockId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "villages_panchayatId_name_key" ON "villages"("panchayatId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "members_membershipNumber_key" ON "members"("membershipNumber");

-- CreateIndex
CREATE INDEX "members_organizationId_aadhaarHash_idx" ON "members"("organizationId", "aadhaarHash");

-- CreateIndex
CREATE INDEX "members_organizationId_mobile_idx" ON "members"("organizationId", "mobile");

-- AddForeignKey
ALTER TABLE "panchayats" ADD CONSTRAINT "panchayats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panchayats" ADD CONSTRAINT "panchayats_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villages" ADD CONSTRAINT "villages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villages" ADD CONSTRAINT "villages_panchayatId_fkey" FOREIGN KEY ("panchayatId") REFERENCES "panchayats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_panchayatId_fkey" FOREIGN KEY ("panchayatId") REFERENCES "panchayats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "villages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "lookups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
