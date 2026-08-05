-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "lastMembershipSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "membershipNumberPrefix" TEXT NOT NULL DEFAULT 'MEM';

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fromStatus" "MemberStatus" NOT NULL,
    "toStatus" "MemberStatus" NOT NULL,
    "remarks" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
