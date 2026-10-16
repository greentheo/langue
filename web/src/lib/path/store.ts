import "server-only";

/**
 * Reading and writing what a learner knows about each path item.
 *
 * The rules live in schedule.ts; this file only moves rows in and out.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { completedLevels, levelAchievement, levelCounts, levelProgress } from "./levels";
import { raisedMarks, unitProgress, type UnitMark, type UnitProgress } from "./planner";
import { applyAnswer, applyChallenge, assumeKnown, completeDialogue, newItemState } from "./schedule";
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

/** One answer in a level-up challenge (schedule.ts: applyChallenge). */
export async function recordChallengeAnswer(
  userId: string,
  language: string,
  item: Item,
  correct: boolean,
  now: Date,
): Promise<{ before: ItemState; after: ItemState }> {
  const row = await prisma.itemProgress.findUnique({
    where: { userId_itemKey: { userId, itemKey: item.key } },
  });
  const before = row ? toState(row) : newItemState(now);
  const after = applyChallenge(before, correct, now);
  const data = { ...after, lastSeenAt: now };
  await prisma.itemProgress.upsert({
    where: { userId_itemKey: { userId, itemKey: item.key } },
    create: { userId, language, itemKey: item.key, kind: item.kind, introducedAt: now, ...data },
    update: data,
  });
  return { before, after };
}

/** Days over which a passed unit's untested items come up for confirmation. */
const CONFIRM_FROM_DAYS = 3;
const CONFIRM_SPREAD_DAYS = 12;

/**
 * A challenge was passed: the rest of the unit is taken as probably known,
 * with confirming reviews spread over the next couple of weeks.
 */
export async function passUnit(
  userId: string,
  language: string,
  course: Course,
  unitIndex: number,
  now: Date,
): Promise<void> {
  const unit = course.units[unitIndex];
  if (!unit) return;
  const states = await loadStates(userId, language);
  const writes = unit.itemKeys.flatMap((key, index) => {
    const item = course.items.get(key);
    if (!item) return [];
    const before = states.get(key) ?? newItemState(now);
    const after = assumeKnown(before, now, CONFIRM_FROM_DAYS + (index % CONFIRM_SPREAD_DAYS));
    if (after === before && states.has(key)) return [];
    return [
      prisma.itemProgress.upsert({
        where: { userId_itemKey: { userId, itemKey: key } },
        create: { userId, language, itemKey: key, kind: item.kind, introducedAt: now, lastSeenAt: now, ...after },
        update: after,
      }),
    ];
  });
  if (writes.length > 0) await prisma.$transaction(writes);
}

/**
 * Record any level the learner has just finished, so the leaderboard can show
 * it and the certificate has a date and its numbers. Returns the levels newly
 * finished.
 */
export async function recordFinishedLevels(
  userId: string,
  language: string,
  course: Course,
  states: Map<string, ItemState>,
  now: Date,
  marks: Map<string, UnitMark> = new Map(),
): Promise<string[]> {
  const done = completedLevels(course, states, marks);
  if (done.length === 0) return [];
  const names = done.map((level) => levelAchievement(language, level));
  const existing = new Set(
    (await prisma.achievement.findMany({ where: { userId, name: { in: names } }, select: { name: true } })).map(
      (row) => row.name,
    ),
  );
  const fresh = done.filter((level) => !existing.has(levelAchievement(language, level)));
  if (fresh.length > 0) {
    await prisma.achievement.createMany({
      data: fresh.map((level) => ({
        userId,
        name: levelAchievement(language, level),
        earnedAt: now,
        // What the certificate prints, kept so later content changes can't alter it.
        detail: { ...levelCounts(levelProgress(course, states, level, marks)) },
      })),
      skipDuplicates: true,
    });
  }
  return fresh;
}

/**
 * Certificates awarded before their numbers were stored get them once, from
 * the learner's progress as it stands. Runs when the server starts; only ever
 * fills an empty one, so running it again changes nothing.
 */
export async function freezeCertificates(courseFor: (language: string) => Course): Promise<number> {
  const empty = await prisma.achievement.findMany({
    where: { name: { startsWith: "level:" }, detail: { equals: Prisma.DbNull } },
    select: { id: true, userId: true, name: true },
  });
  let filled = 0;
  for (const { id, userId, name } of empty) {
    const [, language, level] = name.split(":");
    const course = courseFor(language);
    if (!course.units.some((unit) => unit.level === level)) continue;
    const [states, marks] = await Promise.all([loadStates(userId, language), loadMarks(userId, course)]);
    const detail = { ...levelCounts(levelProgress(course, states, level, marks)) };
    const { count } = await prisma.achievement.updateMany({
      where: { id, detail: { equals: Prisma.DbNull } },
      data: { detail },
    });
    filled += count;
  }
  return filled;
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

/**
 * The best each unit's bar has shown this learner, by unit id. A level the
 * learner has finished keeps every one of its units complete, even if words
 * were added to them since.
 */
export async function loadMarks(userId: string, course?: Course): Promise<Map<string, UnitMark>> {
  const [rows, finished] = await Promise.all([
    prisma.unitMark.findMany({ where: { userId } }),
    course
      ? prisma.achievement.findMany({
          where: { userId, name: { startsWith: `level:${course.language}:` } },
          select: { name: true },
        })
      : [],
  ]);
  const marks = new Map(
    rows.map((row) => [row.unitId, { bestPercent: row.bestPercent, complete: row.completedAt !== null }]),
  );
  for (const { name } of finished) {
    const level = name.split(":")[2];
    for (const unit of course?.units ?? []) {
      if (unit.level === level) marks.set(unit.id, { bestPercent: 100, complete: true });
    }
  }
  return marks;
}

/**
 * Remember everyone's bars as they stand. Runs when the server starts, so a
 * deploy that adds words to units can't lower anyone's bar: the version
 * before it already recorded where everyone was. Only ever raises marks.
 */
export async function rememberEveryonesProgress(
  courseFor: (language: string) => Course,
  now: Date = new Date(),
): Promise<number> {
  const learners = await prisma.itemProgress.groupBy({ by: ["userId", "language"] });
  let raised = 0;
  for (const { userId, language } of learners) {
    const course = courseFor(language);
    if (course.units.length === 0) continue;
    const [states, marks] = await Promise.all([loadStates(userId, language), loadMarks(userId, course)]);
    const progress = unitProgress(course, states, marks);
    raised += raisedMarks(progress, marks).length;
    await rememberProgress(userId, progress, marks, now);
  }
  return raised;
}

/**
 * Remember any unit whose bar is higher than ever before, so that new content
 * in a unit never lowers it. Called wherever progress is shown; only writes
 * when something went up.
 */
export async function rememberProgress(
  userId: string,
  progress: UnitProgress[],
  marks: Map<string, UnitMark>,
  now: Date = new Date(),
): Promise<void> {
  const raised = raisedMarks(progress, marks);
  if (raised.length === 0) return;
  await prisma.$transaction(
    raised.map(({ unitId, bestPercent, complete }) =>
      prisma.unitMark.upsert({
        where: { userId_unitId: { userId, unitId } },
        create: { userId, unitId, bestPercent, completedAt: complete ? now : null },
        update: {
          bestPercent,
          ...(complete && !marks.get(unitId)?.complete ? { completedAt: now } : {}),
        },
      }),
    ),
  );
  for (const { unitId, bestPercent, complete } of raised) {
    marks.set(unitId, { bestPercent, complete: complete || Boolean(marks.get(unitId)?.complete) });
  }
}
