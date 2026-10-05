-- CreateTable
CREATE TABLE "member_password_resets" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_password_resets_memberId_createdAt_idx" ON "member_password_resets"("memberId", "createdAt");

-- AddForeignKey
ALTER TABLE "member_password_resets" ADD CONSTRAINT "member_password_resets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
