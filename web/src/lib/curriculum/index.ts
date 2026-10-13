import "server-only";

/**
 * Curriculum access.
 *
 * Reads the compiled catalog from generated.ts. Server-only: the catalog holds
 * every practice answer, and importing it into a client component would ship
 * all of them to the browser.
 */

import { CURRICULUM } from "./generated";
import { LEVELS, type Level } from "@/lib/vocab/types";
import type {
  Lesson,
  LevelCurriculum,
  Phrase,
  PracticeItem,
  PublicPracticeItem,
  Situation,
} from "./types";

export type { Lesson, LevelCurriculum, Phrase, PracticeItem, PublicPracticeItem, Situation };

const lessonsById = new Map<string, Lesson>();
const phrasesById = new Map<string, Phrase>();

for (const levels of Object.values(CURRICULUM)) {
  for (const level of Object.values(levels)) {
    if (!level) continue;
    for (const lesson of level.lessons) lessonsById.set(lesson.id, lesson);
    for (const situation of level.situations) {
      for (const phrase of situation.phrases) phrasesById.set(phrase.id, phrase);
    }
  }
}

export function getLevelCurriculum(language: string, level: string): LevelCurriculum | null {
  return CURRICULUM[language.toLowerCase()]?.[level.toLowerCase()] ?? null;
}

export function getLesson(id: string): Lesson | null {
  return lessonsById.get(id) ?? null;
}

export function getPhrase(id: string): Phrase | null {
  return phrasesById.get(id) ?? null;
}

/** Levels of a language that have lessons, in CEFR order. */
export function levelsWithLessons(language: string): Level[] {
  return LEVELS.filter((level) => (getLevelCurriculum(language, level)?.lessons.length ?? 0) > 0);
}

/** Levels of a language that have a phrasebook, in CEFR order. */
export function levelsWithPhrases(language: string): Level[] {
  return LEVELS.filter(
    (level) => (getLevelCurriculum(language, level)?.situations.length ?? 0) > 0,
  );
}

/** Levels of a language that have an overview, lessons or not. */
export function levelsWithOverview(language: string): Level[] {
  return LEVELS.filter((level) => Boolean(getLevelCurriculum(language, level)?.overview));
}

export function publicPracticeItem(item: PracticeItem, index: number): PublicPracticeItem {
  return {
    index,
    type: item.type,
    prompt: item.prompt,
    // The page wraps hints in parentheses; some are written with their own.
    hint: item.type === "fill" && item.hint ? item.hint.replace(/^\((.*)\)$/, "$1") : null,
    translation: item.type === "fill" ? (item.translation ?? null) : null,
    direction: item.type === "translate" ? item.direction : null,
    options: item.type === "choice" ? item.options : null,
  };
}

export { acceptedAnswers } from "@/lib/engine/practice";
