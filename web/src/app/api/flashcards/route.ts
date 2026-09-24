import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { getWordsUpToLevel, sampleWords } from "@/lib/vocab";

/**
 * Deal a flashcard round.
 *
 * Translations are deliberately withheld: the client receives the prompt word
 * and its example sentence only, and answers are graded by
 * /api/flashcards/answer. Shipping the answers to the browser would put them
 * one devtools panel away from the input box.
 */

const BodySchema = z.object({
  count: z.number().int().min(1).max(30).default(10),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { language, level } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("count must be between 1 and 30.");
  }

  const pool = getWordsUpToLevel(language, level);
  if (pool.length === 0) {
    throw new BadRequestError(`No vocabulary available for ${language} at ${level}.`);
  }

  const cards = sampleWords(pool, parsed.data.count).map((word) => ({
    word: word.word,
    category: word.category,
    difficulty: word.difficulty,
    // The example shows the word in context without giving away the English.
    example: word.examples[0] ?? null,
    translationCount: word.translations.length,
  }));

  return Response.json({ cards });
});
