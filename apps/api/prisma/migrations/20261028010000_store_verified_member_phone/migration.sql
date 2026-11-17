-- Store confirmation authorizes POS registration only, not WeChat login or account recovery.
ALTER TABLE "Member" ADD COLUMN "phoneStoreVerifiedAt" TIMESTAMP(3);
