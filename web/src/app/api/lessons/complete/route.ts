import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getLesson } from "@/lib/curriculum";
import { recordLessonAttempt } from "@/lib/lessons";

/** Record a finished practice run and update the lesson's best score. */

const BodySchema = z.object({
  lessonId: z.string().min(1).max(120),
  itemsTotal: z.number().int().min(1).max(50),
  itemsCorrect: z.number().int().min(0).max(50),
  pointsEarned: z.number().int().min(0).max(2_000),
  durationSec: z.number().int().min(0).max(24 * 60 * 60),
});

export const POST = handler(async (request) => {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("Lesson result was malformed.");
  }

  const { lessonId, ...attempt } = parsed.data;
  const lesson = getLesson(lessonId);
  if (!lesson) {
    throw new BadRequestError("That lesson does not exist.");
  }
  if (attempt.itemsTotal !== lesson.practice.length || attempt.itemsCorrect > attempt.itemsTotal) {
    throw new BadRequestError("Lesson result does not match the lesson.");
  }

  const outcome = await recordLessonAttempt(user.id, lesson, attempt);
  return Response.json(outcome);
});
