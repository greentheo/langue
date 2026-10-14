import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordSession } from "@/lib/progress";
import { getCourse } from "@/lib/path/course";
import { unitProgress } from "@/lib/path/planner";
import { loadStates } from "@/lib/path/store";

/**
 * Record a finished step: points and streak through the one progress writer,
 * then the unit's progress for the end-of-step screen.
 */

const BodySchema = z.object({
  unitId: z.string().min(1).max(120),
  itemsTotal: z.number().int().min(0).max(60),
  itemsCorrect: z.number().int().min(0).max(60),
  pointsEarned: z.number().int().min(0).max(1_500),
  durationSec: z.number().int().min(0).max(24 * 60 * 60),
});

export const POST = handler(async (request) => {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.itemsCorrect > parsed.data.itemsTotal) {
    throw new BadRequestError("Step result was malformed.");
  }

  const { unitId, ...result } = parsed.data;
  const language = user.currentLanguage;
  const course = getCourse(language);
  const unitIndex = course.units.findIndex((unit) => unit.id === unitId);
  if (unitIndex === -1) {
    throw new BadRequestError("That unit is not on your path.");
  }

  await recordSession({
    userId: user.id,
    activityType: "step",
    language,
    level: course.units[unitIndex].level,
    ...result,
    metadata: { unitId },
  });

  const [states, fresh] = await Promise.all([
    loadStates(user.id, language),
    prisma.user.findUnique({ where: { id: user.id }, select: { streakDays: true } }),
  ]);

  return Response.json({
    unit: unitProgress(course, states)[unitIndex],
    streak: fresh?.streakDays ?? 0,
  });
});
