/**
 * Database smoke test.
 *
 * Exercises the parts of the app that only fail against a real Postgres:
 * the invite-claim race, the session token lookup, and the
 * progress/streak accounting. Unit tests cannot cover these because the bugs
 * they guard against are concurrency and constraint bugs.
 *
 * Destructive — it writes and deletes rows. Point DATABASE_URL at a scratch
 * database, never production:
 *
 *   npm run smoke:db
 */

import { existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { claimInviteUse } from "../src/lib/auth/claim-invite.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const stamp = randomBytes(4).toString("hex");
const email = `smoke-${stamp}@example.test`;

async function main() {
  console.log("Invite redemption");

  // A two-use code: two accounts get in, the third is refused.
  const invite = await prisma.inviteCode.create({
    data: { code: `SMOKE-${stamp.toUpperCase()}`, note: "smoke test", maxUses: 2 },
  });

  const user = await prisma.$transaction(async (tx) => {
    check("first use of a two-use code is claimed", await claimInviteUse(tx, invite.id));
    return tx.user.create({
      data: {
        email,
        displayName: "Smoke Test",
        passwordHash: "scrypt$131072$8$1$c2FsdA==$aGFzaA==",
        currentLanguage: "italian",
        currentLevel: "a1",
        inviteCodeId: invite.id,
      },
    });
  });

  check(
    "second use of a two-use code is claimed",
    await prisma.$transaction((tx) => claimInviteUse(tx, invite.id)),
  );
  check(
    "a third use is refused",
    !(await prisma.$transaction((tx) => claimInviteUse(tx, invite.id))),
  );

  const afterClaims = await prisma.inviteCode.findUniqueOrThrow({ where: { id: invite.id } });
  check("useCount stops at maxUses", afterClaims.useCount === 2, `got ${afterClaims.useCount}`);

  // The race the conditional UPDATE exists for: many registrations hitting a
  // single-use code at once. Exactly one may win.
  const contested = await prisma.inviteCode.create({
    data: { code: `RACE-${stamp.toUpperCase()}`, maxUses: 1 },
  });
  const racers = await Promise.all(
    Array.from({ length: 8 }, () =>
      prisma.$transaction((tx) => claimInviteUse(tx, contested.id)),
    ),
  );
  check(
    "concurrent claims on a single-use code: exactly one wins",
    racers.filter(Boolean).length === 1,
    `${racers.filter(Boolean).length} won`,
  );

  const expired = await prisma.inviteCode.create({
    data: {
      code: `OLD-${stamp.toUpperCase()}`,
      maxUses: 5,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  check(
    "an expired code cannot be claimed",
    !(await prisma.$transaction((tx) => claimInviteUse(tx, expired.id))),
  );

  console.log("\nSessions");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  const found = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  check("session resolves by token hash", found?.user.email === email);
  check("raw token is not stored", found?.tokenHash !== token);

  const expiredHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  await prisma.session.create({
    data: { tokenHash: expiredHash, userId: user.id, expiresAt: new Date(Date.now() - 1000) },
  });
  const pruned = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  check("expired sessions are pruned", pruned.count >= 1);

  console.log("\nProgress accounting");

  const { recordSession, nextStreak } = await import("../src/lib/progress.js");

  await recordSession({
    userId: user.id,
    activityType: "flashcards",
    language: "italian",
    level: "a1",
    pointsEarned: 40,
    itemsTotal: 5,
    itemsCorrect: 4,
    durationSec: 90,
    words: [
      { word: "ciao", correct: true },
      { word: "grazie", correct: true },
      { word: "prego", correct: false },
    ],
  });

  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  check("points credited once", after.points === 40, `got ${after.points}`);

  const logged = await prisma.activityLog.count({ where: { userId: user.id } });
  check("one activity row written", logged === 1, `got ${logged}`);

  const stats = await prisma.wordStat.findMany({
    where: { userId: user.id },
    orderBy: { word: "asc" },
  });
  check("three word stats recorded", stats.length === 3, `got ${stats.length}`);
  check(
    "correct/incorrect split is right",
    stats.find((s) => s.word === "prego")?.incorrect === 1 &&
      stats.find((s) => s.word === "ciao")?.correct === 1,
  );

  const progress = await prisma.languageProgress.findUniqueOrThrow({
    where: { userId_language: { userId: user.id, language: "italian" } },
  });
  check("language word count matches distinct words", progress.wordCount === 3);

  // A second session on the same day must not inflate the streak.
  await recordSession({
    userId: user.id,
    activityType: "reading",
    language: "italian",
    level: "a1",
    pointsEarned: 20,
    itemsTotal: 4,
    itemsCorrect: 3,
    durationSec: 120,
  });

  const afterSecond = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  check("points accumulate", afterSecond.points === 60, `got ${afterSecond.points}`);
  check(
    "same-day session does not inflate the streak",
    afterSecond.streakDays === 1,
    `got ${afterSecond.streakDays}`,
  );

  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-08-12T10:00:00Z");
  check("next-day session extends the streak", nextStreak(new Date(now.getTime() - day), 3, now) === 4);
  check("a gap never resets the streak: it picks up again", nextStreak(new Date(now.getTime() - 3 * day), 9, now) === 10);

  console.log("\nCleanup");
  // Cascades should remove sessions, stats, logs, and progress with the user.
  await prisma.user.delete({ where: { id: user.id } });
  const orphans = await prisma.wordStat.count({ where: { userId: user.id } });
  check("deleting a user cascades to their data", orphans === 0);
  await prisma.inviteCode.deleteMany({
    where: { id: { in: [invite.id, contested.id, expired.id] } },
  });

  console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
