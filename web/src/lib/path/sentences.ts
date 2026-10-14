/**
 * Sentence exercises without a model: cutting a sentence into word tiles,
 * blanking one word out of it, and checking replies to a role-play turn.
 *
 * Pure, so the course builder, the answer route and the tests share one
 * definition of "the same sentence".
 */

import {
  gradeTargetAnswer,
  normalizeAnswer,
  normalizeKeepingAccents,
  type GradeResult,
} from "@/lib/engine/grade";

/** Most and fewest tiles a sentence can be built from. */
export const MIN_TILES = 2;
export const MAX_TILES = 10;

/** Punctuation and dashes at either end of a word: "sei?" → "sei", "¿Dónde" → "Dónde". */
const EDGES = /^[\s.,!?¡¿;:"“”«»…()[\]—–-]+|[\s.,!?¡¿;:"“”«»…()[\]—–-]+$/g;

/**
 * The words of a sentence as tiles, in order. Apostrophes stay inside a word
 * ("l'acqua", "j'ai"), punctuation around it goes, and a lone dash between
 * two speakers is not a word.
 */
export function tilesOf(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((word) => word.replace(EDGES, ""))
    .filter((word) => /\p{L}|\p{N}/u.test(word));
}

export function buildable(sentence: string): boolean {
  const count = tilesOf(sentence).length;
  return count >= MIN_TILES && count <= MAX_TILES;
}

/** Tiles in the right order make the sentence; case and punctuation do not matter. */
export function sameSentence(answer: string, sentence: string): boolean {
  return normalizeKeepingAccents(answer) === normalizeKeepingAccents(tilesOf(sentence).join(" "));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Blank the first of `forms` that appears as a whole word in `sentence`.
 * Returns the text either side and the word as written there, or null when
 * none of the forms appears. Longer forms are tried first, so "un po'" wins
 * over "po".
 */
export function blankOut(
  sentence: string,
  forms: string[],
): { before: string; answer: string; after: string } | null {
  const ordered = [...forms].filter((form) => form.trim()).sort((a, b) => b.length - a.length);
  for (const form of ordered) {
    const pattern = new RegExp(`(^|[^\\p{L}'’])(${escape(form.trim())})(?=$|[^\\p{L}'’])`, "iu");
    const match = pattern.exec(sentence);
    if (!match) continue;
    const start = match.index + match[1].length;
    const answer = match[2];
    return { before: sentence.slice(0, start), answer, after: sentence.slice(start + answer.length) };
  }
  return null;
}

const RIGHT: GradeResult = { verdict: "correct", score: 100, matched: null, note: null };

/**
 * Grade a typed reply in a role-play. Listed replies get the usual leniency
 * (typos and missing accents are close, not wrong); a reply with `*` accepts
 * any word or name in that place: "Mi chiamo *." accepts "Mi chiamo Theo",
 * and "Ciao, mi chiamo Theo".
 */
export function gradeReply(answer: string, accepted: string[]): GradeResult {
  const exact = accepted.filter((reply) => !reply.includes("*"));
  // A reply may carry a little more than listed: "Sì, bene, grazie" for "Bene, grazie".
  const result = gradeTargetAnswer(answer, exact, { extraWords: "any" });
  if (result.verdict !== "incorrect") return result;

  const typed = normalizeAnswer(answer);
  for (const reply of accepted.filter((candidate) => candidate.includes("*"))) {
    const pattern = normalizeAnswer(reply)
      .split("*")
      .map((part) => escape(part))
      .join("\\S.*?");
    // A greeting or "and" in front is fine: "Ciao, mi chiamo Sam" for "Mi chiamo *."
    if (new RegExp(`(^|\\s)${pattern}$`, "u").test(typed)) return { ...RIGHT, matched: reply };
  }
  return result;
}
