-- CreateEnum
CREATE TYPE "LookupCategory" AS ENUM ('OCCUPATION', 'EDUCATION', 'BLOOD_GROUP');

-- CreateTable
CREATE TABLE "lookups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "LookupCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lookups_organizationId_category_value_key" ON "lookups"("organizationId", "category", "value");

-- AddForeignKey
ALTER TABLE "lookups" ADD CONSTRAINT "lookups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
