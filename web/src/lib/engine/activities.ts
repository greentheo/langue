import "server-only";

/**
 * Activity generation.
 *
 * One function per activity, each: pick vocabulary -> build a prompt -> call
 * the model -> validate the JSON. Errors propagate; nothing here fabricates
 * content when the model is unreachable.
 */

import { complete } from "./model";
import { parseModelJson } from "./parse";
import {
  fillBlankPrompt,
  flashcardFeedbackPrompt,
  readingPrompt,
  translationGradePrompt,
  translationPrompt,
  type PromptContext,
} from "./prompts";
import {
  FillBlankResponseSchema,
  ReadingResponseSchema,
  TranslationGradeSchema,
  TranslationResponseSchema,
  type FillBlankExercise,
  type ReadingPassage,
  type TranslationExercise,
  type TranslationGrade,
} from "./schemas";
import { getWordsUpToLevel, sampleWords } from "@/lib/vocab";
import type { VocabWord } from "@/lib/vocab/types";

/** Vocabulary to seed a generated exercise set with. */
function seedWords(context: PromptContext, count: number): VocabWord[] {
  const pool = getWordsUpToLevel(context.language, context.level);
  return sampleWords(pool, Math.min(count * 2, 24));
}

export async function generateFillBlank(
  context: PromptContext,
  count: number,
): Promise<FillBlankExercise[]> {
  const text = await complete({
    system: "You write language-learning exercises and return only valid JSON.",
    messages: [{ role: "user", content: fillBlankPrompt(context, seedWords(context, count), count) }],
    maxTokens: 2000,
    temperature: 0.7,
  });

  return parseModelJson(text, FillBlankResponseSchema).exercises.slice(0, count);
}

export async function generateTranslation(
  context: PromptContext,
  count: number,
  direction: "to-target" | "to-native",
): Promise<TranslationExercise[]> {
  const text = await complete({
    system: "You write language-learning exercises and return only valid JSON.",
    messages: [
      { role: "user", content: translationPrompt(context, seedWords(context, count), count, direction) },
    ],
    maxTokens: 2000,
    temperature: 0.7,
  });

  return parseModelJson(text, TranslationResponseSchema).exercises.slice(0, count);
}

export async function gradeTranslation(
  context: PromptContext,
  source: string,
  expected: string,
  userAnswer: string,
): Promise<TranslationGrade> {
  const text = await complete({
    system: "You grade language-learning answers and return only valid JSON.",
    messages: [
      { role: "user", content: translationGradePrompt(context, source, expected, userAnswer) },
    ],
    maxTokens: 600,
    // Grading should be reproducible; creativity is not wanted here.
    temperature: 0.2,
  });

  return parseModelJson(text, TranslationGradeSchema);
}

export async function generateReading(
  context: PromptContext,
  topic: string | undefined,
  questionCount: number,
): Promise<ReadingPassage> {
  const text = await complete({
    system: "You write language-learning reading material and return only valid JSON.",
    messages: [{ role: "user", content: readingPrompt(context, topic, questionCount) }],
    maxTokens: 3000,
    temperature: 0.7,
  });

  return parseModelJson(text, ReadingResponseSchema);
}

/**
 * Explain a missed flashcard. Returns null rather than throwing: the answer is
 * already graded locally, so losing the explanation should not fail the round.
 */
export async function explainFlashcard(
  context: PromptContext,
  word: VocabWord,
  userAnswer: string,
): Promise<string | null> {
  try {
    return await complete({
      system: "You are a concise, encouraging language tutor.",
      messages: [{ role: "user", content: flashcardFeedbackPrompt(context, word, userAnswer) }],
      maxTokens: 300,
      temperature: 0.6,
    });
  } catch {
    return null;
  }
}
