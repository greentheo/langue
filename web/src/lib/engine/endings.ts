/**
 * Word endings, per language: the inflections the course teaches through A2.
 *
 * In the target language the end of a word is its grammar — cansados or
 * cansadas, comemos or comimos, parlons or parlions — so a slip there is the
 * mistake, not a typo (#70). The grader asks two things of a near miss:
 * does it keep the expected word's ending, and does the expected word keep
 * the typed word's? Only then is it a typo.
 *
 * Endings are written as the grader compares them: lower-case, accents
 * stripped (normalizeAnswer), so "-ées" is "ees" and "-ábamos" is "abamos".
 * Every one listed occurs in the course's own content (endings.test.ts).
 * NEEDS NATIVE CHECK: the tables were written from the A1–A2 grammar the
 * lessons teach, not by a native speaker.
 */

import { KNOWN_FORMS } from "./known-forms.generated";

/** However short the listed ending, a typo must leave a word's last three letters alone. */
export const ENDING_FLOOR = 3;

/** A word keeps at least this much stem: "-amos" is not the ending of "amos". */
const MIN_STEM = 2;

const ITALIAN = [
  // Nouns and adjectives: gender and number.
  "o", "a", "i", "e",
  // Present.
  "iamo", "ate", "ete", "ite", "ano", "ono", "isco", "isci", "isce", "iscono",
  // Imperfect.
  "avo", "avi", "ava", "avamo", "avate", "avano", "evo", "evi", "eva", "evamo", "evano", "ivo", "iva", "ivano",
  // Future and conditional.
  "ero", "erai", "era", "eremo", "erete", "eranno", "iro", "irai", "ira", "iremo",
  "erei", "eresti", "erebbe", "eremmo", "erebbero",
  // Participles, with agreement.
  "ato", "ata", "ati", "uto", "uta", "uti", "ute", "ito", "ita", "iti",
  // Gerund and infinitive (reflexive too).
  "ando", "endo", "are", "ere", "ire", "arsi", "ersi", "irsi",
];

const SPANISH = [
  // Nouns and adjectives.
  "o", "a", "os", "as", "es",
  // Participles, with agreement.
  "ado", "ada", "ados", "adas", "ido", "ida", "idos",
  // Present.
  "amos", "emos", "imos", "an", "en",
  // Preterite.
  "aste", "aron", "iste", "io", "ieron",
  // Imperfect.
  "aba", "abas", "abamos", "aban", "ia", "ias", "iamos", "ian",
  // Future and conditional, on the infinitive.
  "are", "aras", "ara", "aremos", "aran", "ere", "eras", "era", "eremos", "eran", "ire",
  "aria", "arias", "ariamos", "arian", "eria", "erias", "iria",
  // Gerund and infinitive.
  "ando", "iendo", "ar", "er", "ir",
];

const PORTUGUESE = [
  // Nouns and adjectives.
  "o", "a", "os", "as", "es",
  // Participles, with agreement.
  "ado", "ada", "ados", "ido", "ida", "idos", "idas",
  // Present.
  "amos", "emos", "imos", "am", "em",
  // Preterite (perfeito).
  "ei", "ou", "aram", "eu", "eram", "iste", "iu", "iram",
  // Imperfect.
  "ava", "avamos", "avam", "ia", "ias", "iamos", "iam",
  // Future and conditional, on the infinitive.
  "arei", "ara", "aremos", "arao", "erei", "era", "irei", "ira",
  "aria", "eria",
  // Gerund and infinitive.
  "ando", "endo", "indo", "ar", "er", "ir",
];

const FRENCH = [
  // Nouns, adjectives and participles, with agreement (é, ée, és, ées compare as e, ee, es, ees).
  "e", "s", "es", "ee", "ees", "ie", "ies", "is", "ue", "ues", "us",
  // Present.
  "ons", "ez", "ent", "it", "issons", "issez", "issent",
  // Imperfect.
  "ais", "ait", "ions", "iez", "aient",
  // Future and conditional.
  "erai", "eras", "era", "erons", "erez", "eront", "irai", "rai", "ra", "rons", "rez", "ront",
  "erais", "erait", "erions", "eraient", "rais", "rait",
  // Infinitive and present participle.
  "er", "ir", "re", "ant",
];

/** The endings each course language's grader knows, longest first. */
export const ENDINGS: Record<string, string[]> = Object.fromEntries(
  Object.entries({ italian: ITALIAN, spanish: SPANISH, portuguese: PORTUGUESE, french: FRENCH }).map(
    ([language, endings]) => [language, [...new Set(endings)].sort((a, b) => b.length - a.length)],
  ),
);

/**
 * A word's ending as the grader sees it: the longest listed ending that leaves
 * at least two letters of stem, or its last three letters if that is longer.
 * A language with no table gets the last three letters. Takes a normalized
 * word (normalizeAnswer).
 */
export function endingOf(word: string, language: string): string {
  const listed = (ENDINGS[language] ?? []).find(
    (ending) => word.endsWith(ending) && word.length - ending.length >= MIN_STEM,
  );
  const length = Math.max(ENDING_FLOOR, listed?.length ?? 0);
  return word.slice(-Math.min(length, word.length));
}

/**
 * Does a typed word keep the expected word's ending, and the expected word the
 * typed one's? "hablabamos" ends in "amos" like "hablamos", but its own ending
 * is "abamos", so it is another tense, not a typo.
 */
export function keepsEnding(typed: string, expected: string, language: string): boolean {
  return typed.endsWith(endingOf(expected, language)) && expected.endsWith(endingOf(typed, language));
}

let known: Map<string, Set<string>> | null = null;

/** Is this normalized word written anywhere in the language's course content? */
export function isKnownForm(word: string, language: string): boolean {
  known ??= new Map(Object.entries(KNOWN_FORMS).map(([name, words]) => [name, new Set(words.split(" "))]));
  return known.get(language)?.has(word) ?? false;
}
