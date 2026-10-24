ALTER TABLE "Member" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MemberLinkRequest"
  ADD COLUMN "verifiedPhoneHash" TEXT,
  ADD COLUMN "sourceAuthVersion" INTEGER,
  ADD COLUMN "targetAuthVersion" INTEGER,
  ADD COLUMN "selfServiceAllowed" BOOLEAN NOT NULL DEFAULT false;
