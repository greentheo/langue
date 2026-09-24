/**
 * Vocabulary access.
 *
 * Reads the compiled catalog produced by scripts/build-vocab.mjs from the
 * shared data/flashcard_libraries directory, and exposes the few queries the
 * activities actually need. Everything here is synchronous and pure, so it is
 * safe to call from Server Components and Route Handlers alike.
 */

import { VOCAB_CATALOG } from "./generated";
import { LEVELS, LEVEL_LABELS, isLevel, type Level, type VocabWord } from "./types";

export { LEVELS, LEVEL_LABELS, isLevel };
export type { Level, VocabWord };

/** Languages that have at least one usable level, alphabetically. */
export function availableLanguages(): string[] {
  return Object.keys(VOCAB_CATALOG).sort();
}

/** Levels available for a language, in CEFR order. */
export function availableLevels(language: string): Level[] {
  const levels = VOCAB_CATALOG[language.toLowerCase()];
  if (!levels) return [];
  return LEVELS.filter((level) => Array.isArray(levels[level]));
}

export function hasLanguage(language: string): boolean {
  return Object.hasOwn(VOCAB_CATALOG, language.toLowerCase());
}

/** All words for one language/level, or an empty array if absent. */
export function getWords(language: string, level: string): VocabWord[] {
  return VOCAB_CATALOG[language.toLowerCase()]?.[level.toLowerCase()] ?? [];
}

/**
 * Words for a level plus every level below it.
 *
 * A B1 learner should still be reviewing A1/A2 vocabulary — restricting a
 * session to a single band makes flashcards feel arbitrary and starves the
 * upper levels, which hold fewer words by design.
 */
export function getWordsUpToLevel(language: string, level: string): VocabWord[] {
  const ceiling = LEVELS.indexOf(level.toLowerCase() as Level);
  if (ceiling < 0) return [];

  const seen = new Set<string>();
  const words: VocabWord[] = [];

  for (const current of LEVELS.slice(0, ceiling + 1)) {
    for (const word of getWords(language, current)) {
      const key = word.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(word);
    }
  }

  return words;
}

/**
 * Pick `count` distinct words at random.
 *
 * Uses a partial Fisher-Yates shuffle rather than `sort(() => Math.random())`,
 * which is biased, or repeated random indexing, which can return duplicates —
 * seeing the same card twice in one round reads as a bug to the learner.
 */
export function sampleWords(pool: VocabWord[], count: number): VocabWord[] {
  const items = [...pool];
  const take = Math.min(count, items.length);

  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(Math.random() * (items.length - i));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items.slice(0, take);
}

/** Total unique words available for a language across all levels. */
export function wordCount(language: string): number {
  return getWordsUpToLevel(language, "c2").length;
}

/** Display name for a language directory ("italian" -> "Italian"). */
export function languageLabel(language: string): string {
  return language.charAt(0).toUpperCase() + language.slice(1);
}
