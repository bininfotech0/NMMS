-- DropForeignKey
ALTER TABLE "volunteers" DROP CONSTRAINT "volunteers_createdById_fkey";

-- DropForeignKey
ALTER TABLE "volunteers" DROP CONSTRAINT "volunteers_organizationId_fkey";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "interestAreas",
DROP COLUMN "interestedAsVolunteer",
DROP COLUMN "volunteerAvailability",
DROP COLUMN "volunteerExperience";

-- DropTable
DROP TABLE "volunteers";

-- DropEnum
DROP TYPE "InterestArea";

-- DropEnum
DROP TYPE "VolunteerStatus";

