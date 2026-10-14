-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMember_inviteCodeId_idx" ON "GroupMember"("inviteCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_userId_inviteCodeId_key" ON "GroupMember"("userId", "inviteCodeId");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everyone already in a group stays in it: who joined with each code, and
-- who made it.
INSERT INTO "GroupMember" ("id", "userId", "inviteCodeId", "joinedAt")
SELECT gen_random_uuid()::text, u."id", u."inviteCodeId", u."createdAt"
FROM "User" u
WHERE u."inviteCodeId" IS NOT NULL
ON CONFLICT ("userId", "inviteCodeId") DO NOTHING;

INSERT INTO "GroupMember" ("id", "userId", "inviteCodeId", "joinedAt")
SELECT gen_random_uuid()::text, c."createdById", c."id", c."createdAt"
FROM "InviteCode" c
WHERE c."createdById" IS NOT NULL
ON CONFLICT ("userId", "inviteCodeId") DO NOTHING;

-- Codes minted with scripts/mint-invite.mts have no creator. Only the owner
-- runs that script, so they join the first admin's groups.
INSERT INTO "GroupMember" ("id", "userId", "inviteCodeId", "joinedAt")
SELECT gen_random_uuid()::text, admin."id", c."id", c."createdAt"
FROM "InviteCode" c
CROSS JOIN (SELECT "id" FROM "User" WHERE "isAdmin" ORDER BY "createdAt" LIMIT 1) admin
WHERE c."createdById" IS NULL
ON CONFLICT ("userId", "inviteCodeId") DO NOTHING;
