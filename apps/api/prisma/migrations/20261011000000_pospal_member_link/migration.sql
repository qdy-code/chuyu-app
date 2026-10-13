CREATE TABLE "PospalMemberLink" (
  "memberId" TEXT NOT NULL,
  "customerUid" TEXT NOT NULL,
  "customerNumber" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3),
  CONSTRAINT "PospalMemberLink_pkey" PRIMARY KEY ("memberId")
);
CREATE UNIQUE INDEX "PospalMemberLink_customerUid_key" ON "PospalMemberLink"("customerUid");
ALTER TABLE "PospalMemberLink" ADD CONSTRAINT "PospalMemberLink_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
