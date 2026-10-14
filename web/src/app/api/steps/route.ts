import { handler, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { languageLabel } from "@/lib/languages";
import { getCourse } from "@/lib/path/course";
import { planStep } from "@/lib/path/planner";
import { presentStep } from "@/lib/path/present";
import { loadStates, recentAccuracy, seedFromLessons } from "@/lib/path/store";

/**
 * Plan the learner's next ~3-minute step on the guided path.
 *
 * No model call: the step is built from the course and the learner's item
 * states (docs/guided-path.md). The browser gets prompts and teaching only;
 * answers come back one at a time from /api/steps/answer.
 */
export const POST = handler(async () => {
  const user = await requireUser();
  const language = user.currentLanguage;
  const course = getCourse(language);
  if (course.units.length === 0) {
    throw new BadRequestError(`There's no guided path for ${languageLabel(language)} yet.`);
  }

  const now = new Date();
  await seedFromLessons(user.id, language, course, now);
  const [states, accuracy] = await Promise.all([
    loadStates(user.id, language),
    recentAccuracy(user.id, language),
  ]);

  const plan = planStep({ course, states, now, recentAccuracy: accuracy, random: Math.random });
  return Response.json(presentStep(course, plan, Math.random));
});
