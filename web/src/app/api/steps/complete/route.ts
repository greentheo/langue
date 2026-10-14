import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordSession } from "@/lib/progress";
import { getCourse } from "@/lib/path/course";
import { CHALLENGE_PASS, firstOpenUnit, unitCode, unitProgress } from "@/lib/path/planner";
import { LEVELS, type Level } from "@/lib/vocab/types";
import { loadMarks, loadStates, passUnit, recordFinishedLevels, rememberProgress } from "@/lib/path/store";

/**
 * Record a finished step: points and streak through the one progress writer,
 * then the unit's progress for the end-of-step screen.
 *
 * A level-up challenge with at least 80% right completes its unit (the rest
 * of the unit is taken as probably known, and confirmed in review). Either
 * way, a level whose units are all complete is recorded as finished.
 */

const BodySchema = z.object({
  unitId: z.string().min(1).max(120),
  itemsTotal: z.number().int().min(0).max(60),
  itemsCorrect: z.number().int().min(0).max(60),
  pointsEarned: z.number().int().min(0).max(1_500),
  durationSec: z.number().int().min(0).max(24 * 60 * 60),
  challenge: z.boolean().optional(),
});

export const POST = handler(async (request) => {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.itemsCorrect > parsed.data.itemsTotal) {
    throw new BadRequestError("Step result was malformed.");
  }

  const { unitId, challenge, ...result } = parsed.data;
  const language = user.currentLanguage;
  const course = getCourse(language);
  const unitIndex = course.units.findIndex((unit) => unit.id === unitId);
  if (unitIndex === -1) {
    throw new BadRequestError("That unit is not on your path.");
  }

  const now = new Date();
  await recordSession({
    userId: user.id,
    activityType: challenge ? "challenge" : "step",
    language,
    level: course.units[unitIndex].level,
    ...result,
    metadata: { unitId },
  });

  const passed = challenge
    ? result.itemsTotal > 0 && result.itemsCorrect / result.itemsTotal >= CHALLENGE_PASS
    : null;
  if (passed) await passUnit(user.id, language, course, unitIndex, now);

  const [states, marks] = await Promise.all([loadStates(user.id, language), loadMarks(user.id, course)]);
  const units = unitProgress(course, states, marks);
  await rememberProgress(user.id, units, marks, now);
  const [finishedLevels, fresh] = await Promise.all([
    recordFinishedLevels(user.id, language, course, states, now, marks),
    prisma.user.findUnique({ where: { id: user.id }, select: { streakDays: true } }),
  ]);

  // Finishing a level moves the learner up: the header and the practice
  // activities follow the path's level, and it never goes back down.
  if (finishedLevels.length > 0) {
    const open = course.units[Math.min(firstOpenUnit(course, states, marks), course.units.length - 1)];
    const rank = (level: string) => LEVELS.indexOf(level as Level);
    if (open && rank(open.level) > rank(user.currentLevel)) {
      await prisma.user.update({ where: { id: user.id }, data: { currentLevel: open.level } });
    }
  }

  // After a challenge, the next unit not yet complete — to try its challenge too.
  const next = units.find((unit) => unit.index > unitIndex && !unit.complete);

  return Response.json({
    unit: units[unitIndex],
    streak: fresh?.streakDays ?? 0,
    passed,
    next: next ? { id: next.id, code: unitCode(course.units[next.index]), title: next.title } : null,
    finishedLevels,
  });
});
