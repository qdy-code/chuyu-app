CREATE TABLE "PointsLedger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "changePoints" DOUBLE PRECISION NOT NULL,
  "beforePoints" DOUBLE PRECISION NOT NULL,
  "afterPoints" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "relatedOrderId" TEXT,
  "sourceAuditId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PointsLedger_sourceAuditId_key" ON "PointsLedger"("sourceAuditId");
CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt");

-- Import only explicit numeric before/after evidence. Never infer history from current balances.
WITH evidence AS (
  SELECT "id", "createdAt", "action",
    CASE WHEN "action" = 'recharge.approve' THEN "metadata"->>'userId' ELSE "targetId" END AS "userId",
    CASE WHEN "action" = 'member.create' THEN jsonb_build_object('from', 0, 'to', "metadata"->'points')
      WHEN "action" = 'member.update' THEN "metadata"->'changes'->'points'
      ELSE "metadata"->'points' END AS delta,
    CASE WHEN "action" = 'recharge.approve' THEN "targetId"
      WHEN "action" = 'member.recharge' THEN "metadata"->>'rechargeOrderId' END AS "relatedOrderId"
  FROM "AuditLog"
  WHERE ("action" IN ('member.create', 'member.update', 'member.recharge') AND "targetType" = 'member')
    OR ("action" = 'recharge.approve' AND "targetType" = 'recharge_order')
), amounts AS (
  SELECT *,
    CASE WHEN jsonb_typeof(delta->'from') = 'number' THEN (delta->>'from')::numeric END AS before_points,
    CASE WHEN jsonb_typeof(delta->'to') = 'number' THEN (delta->>'to')::numeric END AS after_points
  FROM evidence
)
INSERT INTO "PointsLedger" ("id", "userId", "changePoints", "beforePoints", "afterPoints", "reason", "relatedOrderId", "sourceAuditId", "createdAt")
SELECT 'pl-audit-' || a."id", a."userId", round(after_points - before_points, 2),
  before_points, after_points,
  CASE a."action" WHEN 'member.create' THEN '初始积分（历史）'
    WHEN 'member.update' THEN '门店调整积分（历史）'
    WHEN 'recharge.approve' THEN '充值审核赠送积分（历史）'
    ELSE '门店充值积分（历史）' END,
  a."relatedOrderId", a."id", a."createdAt"
FROM amounts a
WHERE before_points BETWEEN 0 AND 1000000000000
  AND after_points BETWEEN 0 AND 1000000000000
  AND round(after_points - before_points, 2) <> 0
  AND EXISTS (SELECT 1 FROM "Member" m WHERE m."id" = a."userId")
ON CONFLICT ("sourceAuditId") DO NOTHING;
