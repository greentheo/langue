import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getLesson } from "@/lib/curriculum";
import { gradePracticeItem } from "@/lib/lessons";

/**
 * Grade one lesson practice item. The answers never leave the server until
 * this response, which reveals them alongside the verdict.
 */

const BodySchema = z.object({
  lessonId: z.string().min(1).max(120),
  index: z.number().int().min(0).max(50),
  answer: z.string().max(500).default(""),
});

export const POST = handler(async (request) => {
  await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("A lesson, an item and an answer are required.");
  }

  const { lessonId, index, answer } = parsed.data;
  const lesson = getLesson(lessonId);
  const item = lesson?.practice[index];
  if (!lesson || !item) {
    throw new BadRequestError("That practice item does not exist.");
  }

  return Response.json(gradePracticeItem(item, answer, lesson.level, lesson.language));
});
