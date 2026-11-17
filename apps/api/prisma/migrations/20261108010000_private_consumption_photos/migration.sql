CREATE TABLE "ConsumptionPhoto" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "customerUid" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "ConsumptionPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsumptionPhoto_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ConsumptionPhoto_memberId_account_customerUid_orderId_idx" ON "ConsumptionPhoto"("memberId", "account", "customerUid", "orderId");
