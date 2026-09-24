import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { gradeTranslation } from "@/lib/engine/activities";
import { gradeAnswer } from "@/lib/engine/grade";

/**
 * Grade one answer.
 *
 * Fill-in-the-blank has a single expected token, so it is graded locally with
 * the same comparison flashcards use — instant, free, and works offline.
 * Translation is open-ended, where "a different but correct wording" is the
 * normal case, so it goes to the model.
 */

const BodySchema = z.object({
  kind: z.enum(["fill_blank", "translation"]),
  answer: z.string().default(""),
  expected: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  /** Required for translation: the sentence the learner was translating. */
  source: z.string().optional(),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { language, level, nativeLanguage } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Grading request was malformed.");
  }

  const { kind, answer, expected, alternatives, source } = parsed.data;

  if (kind === "fill_blank") {
    const result = gradeAnswer(answer, [expected, ...alternatives]);
    return Response.json({
      correct: result.verdict !== "incorrect",
      verdict: result.verdict,
      score: result.score,
      feedback: result.note ?? "",
      corrected: null,
      expected,
    });
  }

  if (!source) {
    throw new BadRequestError("Translation grading needs the source sentence.");
  }

  const grade = await gradeTranslation(
    { language, level, nativeLanguage },
    source,
    expected,
    answer,
  );

  return Response.json({
    correct: grade.correct,
    verdict: grade.correct ? "correct" : "incorrect",
    score: grade.score,
    feedback: grade.feedback,
    corrected: grade.corrected,
    expected,
  });
});
