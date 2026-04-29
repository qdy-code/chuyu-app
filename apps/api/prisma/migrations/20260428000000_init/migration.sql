-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "phone" TEXT,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "birthday" TEXT,
    "levelId" TEXT NOT NULL,
    "levelName" TEXT NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MemberLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumptionOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productType" TEXT,
    "title" TEXT NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL,
    "effectImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "orderDate" TEXT NOT NULL,
    "remark" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumptionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeAmount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "relatedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_openId_key" ON "Member"("openId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");

-- CreateIndex
CREATE INDEX "Member_levelId_idx" ON "Member"("levelId");

-- CreateIndex
CREATE INDEX "RechargeOrder_userId_idx" ON "RechargeOrder"("userId");

-- CreateIndex
CREATE INDEX "RechargeOrder_status_idx" ON "RechargeOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionOrder_orderNo_key" ON "ConsumptionOrder"("orderNo");

-- CreateIndex
CREATE INDEX "ConsumptionOrder_userId_idx" ON "ConsumptionOrder"("userId");

-- CreateIndex
CREATE INDEX "ConsumptionOrder_orderNo_idx" ON "ConsumptionOrder"("orderNo");

-- CreateIndex
CREATE INDEX "BalanceLedger_userId_idx" ON "BalanceLedger"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

