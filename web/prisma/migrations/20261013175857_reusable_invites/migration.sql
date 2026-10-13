-- Reusable invite codes.
--
-- InviteCode was single-use: redeemedById/redeemedAt pointed at the one account
-- it created. It becomes a code good for `maxUses` accounts, with each User
-- recording the code it joined with (User.inviteCodeId).
--
-- Hand-edited from the `prisma migrate dev --create-only` output so existing
-- data survives: the new columns are added and backfilled from the old ones
-- BEFORE those are dropped. Without this, every account created under the old
-- scheme would lose the record of which code it used.

-- 1. New columns. Existing codes keep their single-use meaning (maxUses = 1).
ALTER TABLE "InviteCode"
ADD COLUMN     "maxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN     "inviteCodeId" TEXT;

-- 2. Backfill from the single-use columns.
UPDATE "User" AS u
SET    "inviteCodeId" = i."id"
FROM   "InviteCode" AS i
WHERE  i."redeemedById" = u."id";

UPDATE "InviteCode"
SET    "useCount" = 1
WHERE  "redeemedAt" IS NOT NULL;

-- 3. Database-level guard against over-redemption. The registration code
-- already claims a use with a conditional increment; this makes a bug there
-- fail loudly instead of quietly minting extra accounts.
ALTER TABLE "InviteCode"
ADD CONSTRAINT "InviteCode_useCount_check"
CHECK ("maxUses" >= 1 AND "useCount" >= 0 AND "useCount" <= "maxUses");

-- 4. Only now drop the single-use columns.
ALTER TABLE "InviteCode" DROP CONSTRAINT "InviteCode_redeemedById_fkey";

DROP INDEX "InviteCode_redeemedById_key";

ALTER TABLE "InviteCode" DROP COLUMN "redeemedAt",
DROP COLUMN "redeemedById";

-- 5. Index and foreign key for the new relation.
CREATE INDEX "User_inviteCodeId_idx" ON "User"("inviteCodeId");

ALTER TABLE "User" ADD CONSTRAINT "User_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
