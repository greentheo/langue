import "server-only";

/**
 * Reading and writing what a learner knows about each path item.
 *
 * The rules live in schedule.ts; this file only moves rows in and out.
 */

import { prisma } from "@/lib/db";
import { applyAnswer, completeDialogue, newItemState } from "./schedule";
import type { Course, Item, ItemState } from "./types";

interface ItemRow {
  stage: number;
  bestStage: number;
  dueAt: Date;
  intervalDays: number;
  right: number;
  wrong: number;
  rightStreak: number;
  missStreak: number;
  tricky: boolean;
}

function toState(row: ItemRow): ItemState {
  return {
    stage: row.stage,
    bestStage: row.bestStage,
    dueAt: row.dueAt,
    intervalDays: row.intervalDays,
    right: row.right,
    wrong: row.wrong,
    rightStreak: row.rightStreak,
    missStreak: row.missStreak,
    tricky: row.tricky,
  };
}

export async function loadStates(userId: string, language: string): Promise<Map<string, ItemState>> {
  const rows = await prisma.itemProgress.findMany({ where: { userId, language } });
  return new Map(rows.map((row) => [row.itemKey, toState(row)]));
}

/** Apply one graded answer to an item, creating its row the first time. */
export async function recordAnswer(
  userId: string,
  language: string,
  item: Item,
  answer: { correct: boolean; rung: number },
  now: Date,
): Promise<{ before: ItemState; after: ItemState }> {
  const row = await prisma.itemProgress.findUnique({
    where: { userId_itemKey: { userId, itemKey: item.key } },
  });
  const before = row ? toState(row) : newItemState(now);
  const after = applyAnswer(before, answer, now);
  const data = { ...after, lastSeenAt: now };

  await prisma.itemProgress.upsert({
    where: { userId_itemKey: { userId, itemKey: item.key } },
    create: { userId, language, itemKey: item.key, kind: item.kind, introducedAt: now, ...data },
    update: data,
  });

  return { before, after };
}

/** A role-play was played to the end: schedule the next time it is offered. */
export async function recordDialoguePlayed(
  userId: string,
  language: string,
  dialogueKey: string,
  now: Date,
): Promise<void> {
  const row = await prisma.itemProgress.findUnique({
    where: { userId_itemKey: { userId, itemKey: dialogueKey } },
  });
  const after = completeDialogue(row ? toState(row) : newItemState(now), now);
  const data = { ...after, lastSeenAt: now };
  await prisma.itemProgress.upsert({
    where: { userId_itemKey: { userId, itemKey: dialogueKey } },
    create: { userId, language, itemKey: dialogueKey, kind: "dialogue", introducedAt: now, ...data },
    update: data,
  });
}

/**
 * Learners who finished lessons before the path existed start with those
 * lessons' ideas and words in review, rather than being taught them again.
 * Runs once: only while the learner has no items in this language.
 */
export async function seedFromLessons(
  userId: string,
  language: string,
  course: Course,
  now: Date,
): Promise<void> {
  if ((await prisma.itemProgress.count({ where: { userId, language } })) > 0) return;

  const finished = await prisma.lessonProgress.findMany({
    where: { userId, language, completedAt: { not: null } },
    select: { lessonId: true },
  });
  if (finished.length === 0) return;

  const lessonIds = new Set(finished.map((lesson) => lesson.lessonId));
  const seeded = [...course.items.values()].filter((item) =>
    item.kind === "grammar" ? lessonIds.has(item.lessonId) : item.kind === "word" && lessonIds.has(item.group),
  );

  await prisma.itemProgress.createMany({
    data: seeded.map((item) => ({
      userId,
      language,
      itemKey: item.key,
      kind: item.kind,
      stage: 1,
      bestStage: 1,
      dueAt: now,
      introducedAt: now,
      lastSeenAt: now,
    })),
    skipDuplicates: true,
  });
}

/** Share of answers right over the last three steps; null before the first step. */
export async function recentAccuracy(userId: string, language: string): Promise<number | null> {
  const steps = await prisma.activityLog.findMany({
    where: { userId, language, activityType: "step" },
    orderBy: { completedAt: "desc" },
    take: 3,
    select: { itemsTotal: true, itemsCorrect: true },
  });
  const total = steps.reduce((sum, step) => sum + step.itemsTotal, 0);
  if (total === 0) return null;
  return steps.reduce((sum, step) => sum + step.itemsCorrect, 0) / total;
}
