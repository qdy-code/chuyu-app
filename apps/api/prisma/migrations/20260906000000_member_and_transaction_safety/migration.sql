ALTER TABLE "Member" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ConsumptionOrder" ADD COLUMN "voidedAt" TIMESTAMP(3), ADD COLUMN "voidedBy" TEXT;

CREATE TABLE "MemberLinkRequest" (
    "userId" TEXT NOT NULL,
    "targetMemberId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "MemberLinkRequest_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "MemberLinkRequest_codeHash_key" ON "MemberLinkRequest"("codeHash");
CREATE INDEX "MemberLinkRequest_targetMemberId_idx" ON "MemberLinkRequest"("targetMemberId");

CREATE TABLE "MutationReceipt" (
    "id" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MutationReceipt_pkey" PRIMARY KEY ("id")
);
