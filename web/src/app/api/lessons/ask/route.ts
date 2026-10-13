import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getLesson } from "@/lib/curriculum";
import { lessonDigest } from "@/lib/lessons";
import { complete } from "@/lib/engine/model";
import { languageLabel } from "@/lib/vocab";

/**
 * Answer a learner's question about a lesson — the one model call in Lessons.
 * The lesson itself is the context, so answers stay on topic and at level.
 */

const BodySchema = z.object({
  lessonId: z.string().min(1).max(120),
  question: z.string().trim().min(2).max(500),
});

export const POST = handler(async (request) => {
  await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("Ask a question of up to 500 characters.");
  }

  const lesson = getLesson(parsed.data.lessonId);
  if (!lesson) {
    throw new BadRequestError("That lesson does not exist.");
  }

  const language = languageLabel(lesson.language);
  const answer = await complete({
    system:
      `You are a patient, encouraging ${language} tutor. The learner speaks English, is at ` +
      `CEFR ${lesson.level.toUpperCase()}, and may be a teenager. Answer their question about ` +
      `the lesson below in plain English: two to six short sentences, with at most two short ` +
      `${language} examples, each followed by its English translation. Use **bold** for the ` +
      `key ${language} forms. If the question needs grammar this level has not covered, answer ` +
      `briefly and say it comes later. If it is not about learning ${language}, steer back ` +
      `kindly. Never invent rules; if unsure, say so.\n\n${lessonDigest(lesson)}`,
    messages: [{ role: "user", content: parsed.data.question }],
    maxTokens: 600,
    temperature: 0.4,
  });

  return Response.json({ answer });
});
