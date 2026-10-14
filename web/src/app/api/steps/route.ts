import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { languageLabel } from "@/lib/languages";
import { getCourse } from "@/lib/path/course";
import { planChallenge, planStep } from "@/lib/path/planner";
import { presentStep } from "@/lib/path/present";
import { loadMarks, loadStates, recentAccuracy, seedFromLessons } from "@/lib/path/store";

/**
 * Plan the learner's next ~3-minute step on the guided path — or, given a
 * unit, its level-up challenge.
 *
 * No model call: the step is built from the course and the learner's item
 * states (docs/guided-path.md). The browser gets prompts and teaching only;
 * answers come back one at a time from /api/steps/answer.
 */
const BodySchema = z.object({ challenge: z.string().min(1).max(120).optional() });

export const POST = handler(async (request) => {
  const user = await requireUser();
  const body = BodySchema.safeParse(await readJson(request).catch(() => ({})));
  const challenge = body.success ? body.data.challenge : undefined;
  const language = user.currentLanguage;
  const course = getCourse(language);
  if (course.units.length === 0) {
    throw new BadRequestError(`There's no guided path for ${languageLabel(language)} yet.`);
  }

  const now = new Date();
  await seedFromLessons(user.id, language, course, now);
  const [states, accuracy, marks] = await Promise.all([
    loadStates(user.id, language),
    recentAccuracy(user.id, language),
    loadMarks(user.id, course),
  ]);

  if (challenge) {
    const unitIndex = course.units.findIndex((unit) => unit.id === challenge);
    if (unitIndex === -1) throw new BadRequestError("That unit is not on your path.");
    const plan = planChallenge(course, unitIndex, states, Math.random);
    return Response.json(presentStep(course, plan, Math.random));
  }

  const plan = planStep({ course, states, now, recentAccuracy: accuracy, random: Math.random, marks });
  return Response.json(presentStep(course, plan, Math.random));
});
