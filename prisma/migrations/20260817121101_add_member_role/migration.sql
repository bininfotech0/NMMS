-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('MEMBER');

-- AlterTable
ALTER TABLE "members" ADD COLUMN     "role" "MemberRole" NOT NULL DEFAULT 'MEMBER';
