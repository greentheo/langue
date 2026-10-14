import "server-only";

/**
 * Progress accounting.
 *
 * Every points change in the app goes through `recordSession`. The CLI awards
 * points from both the activity and the storage layer for the same answer, so
 * totals drift upward with no way to reconcile them (issue #10). Here there is
 * exactly one writer, it runs in a transaction, and the user's denormalized
 * totals are always the sum of what the ActivityLog says.
 */

import { prisma } from "@/lib/db";
import type { ActivityType } from "@/lib/activity-types";
import { nextStreak } from "@/lib/standings";

// Streak arithmetic is pure and lives with the leaderboard's (lib/standings.ts).
export { nextStreak };

export interface WordOutcome {
  word: string;
  correct: boolean;
}

export interface SessionResult {
  userId: string;
  activityType: ActivityType;
  language: string;
  level: string;
  pointsEarned: number;
  itemsTotal: number;
  itemsCorrect: number;
  durationSec: number;
  /** Words the learner was exposed to, with whether they got each right. */
  words?: WordOutcome[];
  metadata?: Record<string, unknown>;
}

export async function recordSession(result: SessionResult): Promise<void> {
  const {
    userId,
    activityType,
    language,
    level,
    pointsEarned,
    itemsTotal,
    itemsCorrect,
    durationSec,
    words = [],
    metadata,
  } = result;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lastActiveAt: true, streakDays: true },
    });

    await tx.activityLog.create({
      data: {
        userId,
        activityType,
        language,
        level,
        pointsEarned,
        itemsTotal,
        itemsCorrect,
        durationSec,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    // Word exposure. Upserted one at a time because the counters are
    // read-modify-write per word and there is no bulk equivalent that keeps
    // `exposures` accurate under concurrent sessions.
    for (const { word, correct } of words) {
      await tx.wordStat.upsert({
        where: { userId_language_word: { userId, language, word } },
        create: {
          userId,
          language,
          word,
          exposures: 1,
          correct: correct ? 1 : 0,
          incorrect: correct ? 0 : 1,
        },
        update: {
          exposures: { increment: 1 },
          correct: { increment: correct ? 1 : 0 },
          incorrect: { increment: correct ? 0 : 1 },
          lastSeen: now,
        },
      });
    }

    const distinctWords = await tx.wordStat.count({ where: { userId, language } });

    await tx.languageProgress.upsert({
      where: { userId_language: { userId, language } },
      create: { userId, language, level, wordCount: distinctWords, points: pointsEarned },
      update: {
        level,
        wordCount: distinctWords,
        points: { increment: pointsEarned },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: pointsEarned },
        streakDays: nextStreak(user.lastActiveAt, user.streakDays, now),
        lastActiveAt: now,
        // Back practising: the reminder schedule starts over.
        reminderCount: 0,
      },
    });
  });
}

/** Dashboard summary for one user. */
export async function getSummary(userId: string) {
  const [user, languages, recent, totalSessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        points: true,
        streakDays: true,
        lastActiveAt: true,
        currentLanguage: true,
        currentLevel: true,
      },
    }),
    prisma.languageProgress.findMany({
      where: { userId },
      orderBy: { points: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take: 8,
    }),
    prisma.activityLog.count({ where: { userId } }),
  ]);

  return { user, languages, recent, totalSessions };
}
