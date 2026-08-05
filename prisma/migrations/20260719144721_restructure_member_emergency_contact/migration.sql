/*
  Warnings:

  - You are about to drop the column `emergencyContact` on the `members` table. All the data in the column will be lost.

  If any org has emergencyContact populated before this migration runs,
  backfill manually first:
    UPDATE members SET "emergencyContactName" = "emergencyContact" WHERE "emergencyContact" IS NOT NULL;
  (mobile/relationship can't be recovered from the old free-text field and are left null)
*/
-- AlterTable
ALTER TABLE "members" DROP COLUMN "emergencyContact",
ADD COLUMN     "emergencyContactMobile" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT;
