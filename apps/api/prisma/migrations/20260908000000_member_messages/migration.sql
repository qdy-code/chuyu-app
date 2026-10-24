CREATE TABLE "MemberMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    CONSTRAINT "MemberMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberMessage_userId_createdAt_idx" ON "MemberMessage"("userId", "createdAt");
CREATE INDEX "MemberMessage_readAt_createdAt_idx" ON "MemberMessage"("readAt", "createdAt");
