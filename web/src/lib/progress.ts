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

export interface WordOutcome {
  word: string;
  correct: boolean;
}

export interface SessionResult {
  userId: string;
  activityType: "flashcards" | "conversation" | "fill_blank" | "translation" | "reading";
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

/** A day in ms, for streak arithmetic. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-aligned day index, so a streak is about calendar days not 24h gaps. */
function dayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
}

/**
 * Recompute the streak from the previous activity date.
 *
 * Same day: unchanged. Next day: +1. Any longer gap: back to 1. The CLI
 * increments on every session, so five sessions in one evening read as a
 * five-day streak.
 */
export function nextStreak(previousActive: Date, currentStreak: number, now: Date): number {
  const gap = dayIndex(now) - dayIndex(previousActive);
  if (gap <= 0) return Math.max(1, currentStreak);
  if (gap === 1) return currentStreak + 1;
  return 1;
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
      },
    });
  });
}

/** Dashboard summary for one user. */
export async function getSummary(userId: string) {
  const [user, languages, recent, totalSessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { points: true, streakDays: true, currentLanguage: true, currentLevel: true },
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
