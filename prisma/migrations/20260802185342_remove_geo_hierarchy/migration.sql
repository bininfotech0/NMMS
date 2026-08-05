-- AlterEnum
-- DISTRICT_ADMIN/BLOCK_ADMIN are being removed from the Role enum. Any user
-- still holding one of those roles is migrated to ADMIN first, since Postgres
-- can't cast a value to an enum type that no longer contains it.
BEGIN;
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" IN ('DISTRICT_ADMIN', 'BLOCK_ADMIN');
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FIELD_EXECUTIVE');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "blocks" DROP CONSTRAINT "blocks_districtId_fkey";

-- DropForeignKey
ALTER TABLE "blocks" DROP CONSTRAINT "blocks_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "districts" DROP CONSTRAINT "districts_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "districts" DROP CONSTRAINT "districts_stateId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_blockId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_districtId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_panchayatId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_permBlockId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_permDistrictId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_permPanchayatId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_permStateId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_permVillageId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_stateId_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_villageId_fkey";

-- DropForeignKey
ALTER TABLE "panchayats" DROP CONSTRAINT "panchayats_blockId_fkey";

-- DropForeignKey
ALTER TABLE "panchayats" DROP CONSTRAINT "panchayats_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "states" DROP CONSTRAINT "states_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_jurisdictionBlockId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_jurisdictionDistrictId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_jurisdictionStateId_fkey";

-- DropForeignKey
ALTER TABLE "villages" DROP CONSTRAINT "villages_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "villages" DROP CONSTRAINT "villages_panchayatId_fkey";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "blockId",
DROP COLUMN "districtId",
DROP COLUMN "panchayatId",
DROP COLUMN "permBlockId",
DROP COLUMN "permDistrictId",
DROP COLUMN "permPanchayatId",
DROP COLUMN "permStateId",
DROP COLUMN "permVillageId",
DROP COLUMN "stateId",
DROP COLUMN "villageId";

-- AlterTable
ALTER TABLE "notices" DROP COLUMN "districtId";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "jurisdictionBlockId",
DROP COLUMN "jurisdictionDistrictId",
DROP COLUMN "jurisdictionStateId";

-- DropTable
DROP TABLE "blocks";

-- DropTable
DROP TABLE "districts";

-- DropTable
DROP TABLE "panchayats";

-- DropTable
DROP TABLE "states";

-- DropTable
DROP TABLE "villages";

