ALTER TABLE "Member" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
CREATE TABLE "PospalMemberSync" (
  "memberId" TEXT PRIMARY KEY,
  "account" TEXT NOT NULL,
  "customerNumber" TEXT NOT NULL,
  "customerUid" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createAttemptedAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PospalMemberSync_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PospalMemberSync_customerNumber_key" ON "PospalMemberSync"("customerNumber");
CREATE INDEX "PospalMemberSync_state_nextAttemptAt_idx" ON "PospalMemberSync"("state", "nextAttemptAt");
