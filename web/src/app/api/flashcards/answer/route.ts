import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { getWordsUpToLevel } from "@/lib/vocab";
import { gradeAnswer, pointsForResult } from "@/lib/engine/grade";
import { explainFlashcard } from "@/lib/engine/activities";
import { prisma } from "@/lib/db";

/**
 * Grade one flashcard answer.
 *
 * Grading is local string comparison — no model call, so a round still works
 * when the API is down. The model is used only to explain a wrong answer, and
 * `explainFlashcard` returns null rather than throwing if that call fails.
 */

const BodySchema = z.object({
  word: z.string().min(1),
  answer: z.string().default(""),
  /** Ask for an explanation on a miss. Off for rapid drilling. */
  explain: z.boolean().default(true),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { user, language, level, nativeLanguage } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("A word and an answer are required.");
  }

  const { word: wordText, answer, explain } = parsed.data;

  const entry = getWordsUpToLevel(language, level).find(
    (candidate) => candidate.word.toLowerCase() === wordText.toLowerCase(),
  );

  if (!entry) {
    throw new BadRequestError(`"${wordText}" is not in the ${language} ${level} deck.`);
  }

  const result = gradeAnswer(answer, entry.translations);
  const points = pointsForResult(result, entry.difficulty);

  // The review row is the per-answer audit trail; session totals are written
  // once at the end of the round via /api/progress, so points are not counted
  // twice.
  await prisma.flashcardReview.create({
    data: {
      userId: user.id,
      language,
      level,
      word: entry.word,
      expected: entry.translations.join(", "),
      userAnswer: answer,
      score: result.score,
      correct: result.verdict !== "incorrect",
    },
  });

  const explanation =
    explain && result.verdict === "incorrect"
      ? await explainFlashcard({ language, level, nativeLanguage }, entry, answer)
      : null;

  return Response.json({
    verdict: result.verdict,
    score: result.score,
    points,
    note: result.note,
    translations: entry.translations,
    example: entry.examples[0] ?? null,
    explanation,
  });
});
