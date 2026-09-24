/**
 * CEFR level descriptions used to steer the model.
 *
 * The Python CLI redefines a level map in five different activity modules,
 * each slightly different, so the same "B1" means different things depending
 * on which activity you opened. This is the single definition for the web app.
 */

import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/vocab/types";

export { LEVELS, LEVEL_LABELS };
export type { Level };

/** What a learner at each level can handle, phrased for a prompt. */
export const LEVEL_GUIDANCE: Record<Level, string> = {
  a1:
    "Absolute beginner. Use only the most common words, present tense, and " +
    "short sentences of 3-8 words. Avoid idioms, subordinate clauses, and any " +
    "tense beyond the present.",
  a2:
    "Elementary. Everyday topics: family, shopping, directions, routines. " +
    "Simple past and near future are fine. Keep sentences under 12 words.",
  b1:
    "Intermediate. Can handle work, travel, and personal interests. Use " +
    "common connectives, past and future tenses, and occasional subjunctive.",
  b2:
    "Upper intermediate. Comfortable with abstract topics and argument. Use " +
    "varied tenses, hypotheticals, and moderately technical vocabulary.",
  c1:
    "Advanced. Use idiomatic and professional register, nuanced connectives, " +
    "and complex sentence structure. Do not simplify.",
  c2:
    "Mastery. Write as you would for an educated native speaker: literary or " +
    "specialized register, cultural references, and full idiomatic range.",
};

/** Sentence-length ceiling per level, used where an explicit cap helps. */
export const LEVEL_MAX_SENTENCE_WORDS: Record<Level, number> = {
  a1: 8,
  a2: 12,
  b1: 18,
  b2: 25,
  c1: 35,
  c2: 45,
};

/** Levels at which the UI offers English support by default. */
export function isBeginnerLevel(level: Level): boolean {
  return level === "a1" || level === "a2";
}

/** Map a 1-5 difficulty dial to a CEFR level, as the CLI's activities do. */
export function levelFromDifficulty(difficulty: number): Level {
  const clamped = Math.max(1, Math.min(5, Math.round(difficulty)));
  return (["a1", "a2", "b1", "b2", "c1"] as const)[clamped - 1];
}

export function difficultyFromLevel(level: Level): number {
  return Math.min(5, LEVELS.indexOf(level) + 1);
}
