/**
 * Database smoke test.
 *
 * Exercises the parts of the app that only fail against a real Postgres:
 * the invite-redemption transaction, the session token lookup, and the
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

  const invite = await prisma.inviteCode.create({
    data: { code: `SMOKE-${stamp.toUpperCase()}`, note: "smoke test" },
  });

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        displayName: "Smoke Test",
        passwordHash: "scrypt$131072$8$1$c2FsdA==$aGFzaA==",
        currentLanguage: "italian",
        currentLevel: "a1",
      },
    });
    const claimed = await tx.inviteCode.updateMany({
      where: { id: invite.id, redeemedAt: null },
      data: { redeemedAt: new Date(), redeemedById: created.id },
    });
    check("invite claimed exactly once", claimed.count === 1);
    return created;
  });

  // The conditional update is what stops two concurrent registrations from
  // spending the same code. Re-running it must be a no-op.
  const second = await prisma.inviteCode.updateMany({
    where: { id: invite.id, redeemedAt: null },
    data: { redeemedAt: new Date() },
  });
  check("already-redeemed invite cannot be claimed again", second.count === 0);

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
  check("a two-day gap resets the streak", nextStreak(new Date(now.getTime() - 3 * day), 9, now) === 1);

  console.log("\nCleanup");
  // Cascades should remove sessions, stats, logs, and progress with the user.
  await prisma.user.delete({ where: { id: user.id } });
  const orphans = await prisma.wordStat.count({ where: { userId: user.id } });
  check("deleting a user cascades to their data", orphans === 0);
  await prisma.inviteCode.deleteMany({ where: { id: invite.id } });

  console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
