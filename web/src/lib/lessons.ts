import "server-only";

/**
 * Lesson grading and progress.
 *
 * Practice answers live only in the compiled curriculum on the server; the
 * browser sends what the learner typed and gets a verdict back, as flashcards
 * do. Completion is recorded once per finished practice run.
 */

import { prisma } from "@/lib/db";
import { recordSession } from "@/lib/progress";
import type { Lesson } from "@/lib/curriculum";

export { difficultyForLevel, gradePracticeItem, type ItemGrade } from "@/lib/engine/practice";

/** Score, out of 100, at which a lesson counts as completed. */
export const PASS_MARK = 70;

export interface LessonAttempt {
  itemsTotal: number;
  itemsCorrect: number;
  pointsEarned: number;
  durationSec: number;
}

export interface LessonOutcome {
  score: number;
  passed: boolean;
  bestScore: number;
  completed: boolean;
}

/** Record a finished practice run: the session, then the lesson's best score. */
export async function recordLessonAttempt(
  userId: string,
  lesson: Lesson,
  attempt: LessonAttempt,
): Promise<LessonOutcome> {
  const score = attempt.itemsTotal > 0
    ? Math.round((attempt.itemsCorrect / attempt.itemsTotal) * 100)
    : 0;
  const passed = score >= PASS_MARK;

  await recordSession({
    userId,
    activityType: "lesson",
    language: lesson.language,
    level: lesson.level,
    pointsEarned: attempt.pointsEarned,
    itemsTotal: attempt.itemsTotal,
    itemsCorrect: attempt.itemsCorrect,
    durationSec: attempt.durationSec,
    metadata: { lessonId: lesson.id, score },
  });

  const now = new Date();

  const progress = await prisma.$transaction(async (tx) => {
    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });

    if (!existing) {
      return tx.lessonProgress.create({
        data: {
          userId,
          lessonId: lesson.id,
          language: lesson.language,
          level: lesson.level,
          bestScore: score,
          attempts: 1,
          completedAt: passed ? now : null,
        },
      });
    }

    return tx.lessonProgress.update({
      where: { id: existing.id },
      data: {
        attempts: { increment: 1 },
        bestScore: Math.max(existing.bestScore, score),
        // Keep the first completion date; a later lower score does not undo it.
        completedAt: existing.completedAt ?? (passed ? now : null),
      },
    });
  });

  return {
    score,
    passed,
    bestScore: progress.bestScore,
    completed: progress.completedAt !== null,
  };
}

export interface LessonStatus {
  bestScore: number;
  completed: boolean;
}

/** Progress for every lesson the user has tried at one language and level. */
export async function lessonStatuses(
  userId: string,
  language: string,
  level: string,
): Promise<Map<string, LessonStatus>> {
  const rows = await prisma.lessonProgress.findMany({
    where: { userId, language, level },
    select: { lessonId: true, bestScore: true, completedAt: true },
  });

  return new Map(
    rows.map((row) => [row.lessonId, { bestScore: row.bestScore, completed: row.completedAt !== null }]),
  );
}

/** The first lesson not yet completed, in path order; null when all are done. */
export function nextLesson(lessons: Lesson[], statuses: Map<string, LessonStatus>): Lesson | null {
  return lessons.find((lesson) => !statuses.get(lesson.id)?.completed) ?? null;
}

/** Plain-text digest of a lesson, used as context for tutor questions. */
export function lessonDigest(lesson: Lesson): string {
  const parts = [`Lesson: ${lesson.title}${lesson.subtitle ? ` — ${lesson.subtitle}` : ""}`];
  parts.push(`Goal: after this lesson the learner can ${lesson.goal}.`);

  for (const section of lesson.sections) {
    parts.push(`\n## ${section.heading}\n${section.body.trim()}`);
    if (section.table) {
      parts.push(section.table.columns.join(" | "));
      for (const row of section.table.rows) parts.push(row.join(" | "));
    }
    if (section.examples) {
      for (const [target, english] of section.examples) parts.push(`- ${target} = ${english}`);
    }
    if (section.tip) parts.push(`Tip: ${section.tip}`);
  }

  if (lesson.words.length > 0) {
    parts.push(`\nWords: ${lesson.words.map(([target, english]) => `${target} (${english})`).join(", ")}`);
  }

  return parts.join("\n");
}
