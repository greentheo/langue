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

interface AccentPair {
  /** Two different words, or two forms of one (pôde and pode are both poder). */
  kind: "word" | "form";
  accented: string;
  plain: string;
}

/**
 * The common short words an accent turns into another (#120 review), with what
 * both mean: the course glosses few of them as words, and "«à», not «a»" says
 * *that* without *why*. Keyed "accented plain", accents kept.
 */
const ACCENT_PAIRS: Record<string, Record<string, AccentPair>> = {
  italian: {
    "è e": { kind: "word", accented: "is", plain: "and" },
  },
  spanish: {
    "está esta": { kind: "word", accented: "is", plain: "this" },
    "tú tu": { kind: "word", accented: "you (informal)", plain: "your" },
    "sí si": { kind: "word", accented: "yes", plain: "if" },
    "él el": { kind: "word", accented: "he", plain: "the" },
  },
  french: {
    "où ou": { kind: "word", accented: "where", plain: "or" },
    "à a": { kind: "word", accented: "to, at", plain: "has" },
  },
  portuguese: {
    "pôde pode": { kind: "form", accented: "could, in the past", plain: "can" },
    "é e": { kind: "word", accented: "is", plain: "and" },
    "está esta": { kind: "word", accented: "is", plain: "this" },
  },
};

/** A short word typed without its accent, when the plain spelling is another word or form: "è" typed "e". */
export function accentPair(expected: string, typed: string, language: string): AccentPair | undefined {
  return ACCENT_PAIRS[language]?.[`${expected} ${typed}`];
}
