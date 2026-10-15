/**
 * Answer normalization, shared by the grader and by codegen (the known-forms
 * list in scripts/build-known-forms.mts), so both compare words the same way.
 * A leaf module: it imports nothing.
 */

/**
 * Punctuation that never changes meaning for grading. Includes the curly
 * quotes and apostrophes phone keyboards insert by default: without them,
 * "l’acqua" typed on an iPhone would not match "l'acqua".
 */
const PUNCTUATION = /[.,!?¡¿;:"'`’‘“”«»…()[\]]/g;

/** Hyphens and dashes separate words: "twenty-one" matches "twenty one". */
const DASHES = /[-‐–—]/g;

/** Ligatures people type as two letters: "soeur" is a fine way to write "sœur". */
function unligature(value: string): string {
  return value.replace(/œ/g, "oe").replace(/æ/g, "ae");
}

/** Normalize for comparison: casefold, strip accents, punctuation, articles. */
export function normalizeAnswer(value: string): string {
  return unligature(value.toLowerCase())
    .normalize("NFD")
    // Strip combining diacritics so "cafe" matches "café".
    .replace(/[\u0300-\u036f]/g, "")
    .replace(PUNCTUATION, "")
    .replace(DASHES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** As normalizeAnswer, but keeps accents, for target-language accent checks. */
export function normalizeKeepingAccents(value: string): string {
  return unligature(value.toLowerCase())
    .normalize("NFC")
    .replace(PUNCTUATION, "")
    .replace(DASHES, " ")
    .replace(/\s+/g, " ")
    .trim();
}
