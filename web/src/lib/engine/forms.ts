/**
 * The course's own words as written, accents kept, and what single words mean
 * (#114): so the grader can tell that "parle" is a real form next to "parlé",
 * and say that "è" is "is" while "e" is "and". Built at codegen from the
 * course content (scripts/build-known-forms.mts).
 */

import { GLOSSES, KNOWN_WRITTEN_FORMS } from "./known-forms.generated";

let written: Map<string, Set<string>> | null = null;

/** Is this word, accents as written (normalizeKeepingAccents), used anywhere in the language's course? */
export function isKnownWrittenForm(word: string, language: string): boolean {
  written ??= new Map(Object.entries(KNOWN_WRITTEN_FORMS).map(([name, words]) => [name, new Set(words.split(" "))]));
  return written.get(language)?.has(word) ?? false;
}

/** What a single word means, when the course teaches it as a word: "où" → "where". */
export function glossOf(word: string, language: string): string | undefined {
  return GLOSSES[language]?.[word];
}
