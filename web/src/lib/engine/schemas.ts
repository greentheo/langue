/**
 * Zod schemas for model output.
 *
 * Every activity validates the model's JSON against one of these before it
 * reaches the UI, so a malformed generation fails at the boundary with a clear
 * error instead of rendering `undefined` into an exercise.
 */

import { z } from "zod";

export const FillBlankExerciseSchema = z.object({
  sentence: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().default(""),
  translation: z.string().default(""),
});

export const FillBlankResponseSchema = z.object({
  exercises: z.array(FillBlankExerciseSchema).min(1),
});

export const TranslationExerciseSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  note: z.string().default(""),
});

export const TranslationResponseSchema = z.object({
  exercises: z.array(TranslationExerciseSchema).min(1),
});

export const TranslationGradeSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string().default(""),
  corrected: z.string().nullable().default(null),
});

export const ReadingQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().default(""),
});

export const ReadingResponseSchema = z.object({
  title: z.string().default(""),
  passage: z.string().min(1),
  translation: z.string().default(""),
  questions: z.array(ReadingQuestionSchema).min(1),
});

export type FillBlankExercise = z.infer<typeof FillBlankExerciseSchema>;
export type TranslationExercise = z.infer<typeof TranslationExerciseSchema>;
export type TranslationGrade = z.infer<typeof TranslationGradeSchema>;
export type ReadingQuestion = z.infer<typeof ReadingQuestionSchema>;
export type ReadingPassage = z.infer<typeof ReadingResponseSchema>;
