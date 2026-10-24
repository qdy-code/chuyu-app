DO $$
DECLARE
  member_record RECORD;
  next_sequence INTEGER := 0;
  next_member_number TEXT;
BEGIN
  FOR member_record IN
    SELECT id
    FROM "Member"
    WHERE id !~ '^MI[0-9]{12}$'
    ORDER BY id
  LOOP
    LOOP
      next_sequence := next_sequence + 1;
      next_member_number :=
        'MI' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD(next_sequence::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "Member" WHERE id = next_member_number
      );
    END LOOP;

    UPDATE "RechargeOrder" SET "userId" = next_member_number WHERE "userId" = member_record.id;
    UPDATE "ConsumptionOrder" SET "userId" = next_member_number WHERE "userId" = member_record.id;
    UPDATE "Appointment" SET "userId" = next_member_number WHERE "userId" = member_record.id;
    UPDATE "BalanceLedger" SET "userId" = next_member_number WHERE "userId" = member_record.id;
    UPDATE "AccessoryProduct"
      SET "reservedByUserId" = next_member_number
      WHERE "reservedByUserId" = member_record.id;
    UPDATE "AuditLog" SET "actorId" = next_member_number WHERE "actorId" = member_record.id;
    UPDATE "AuditLog"
      SET "targetId" = next_member_number
      WHERE "targetId" = member_record.id AND "targetType" IN ('member', 'user');
    UPDATE "Member"
      SET id = next_member_number, "accountIdChangedAt" = NULL
      WHERE id = member_record.id;
  END LOOP;
END $$;
