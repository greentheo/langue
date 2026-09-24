/**
 * Answer grading.
 *
 * Deliberately local and deterministic: asking the model to grade "does 'hello'
 * match 'ciao'?" costs a round trip and a token bill for something string
 * comparison answers correctly, and it makes flashcards unusable when the API
 * is down. The model is reserved for work only it can do — generating content
 * and explaining mistakes.
 */

/** Normalize for comparison: casefold, strip accents, punctuation, articles. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritics so "cafe" matches "café".
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¡¿;:"'`()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Drop a leading article so "the water" matches "water" and "il cane" matches
 * "cane". Only ever strips one leading token, and never the whole string.
 */
export function stripArticle(value: string): string {
  const articles = [
    // English
    "the", "a", "an",
    // Romance definite/indefinite articles
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "le", "les", "l", "du", "des", "il", "lo", "gli", "i",
    "o", "as", "os", "uma", "uns", "umas",
    "to", // English infinitive marker: "to run" vs "run"
  ];

  const parts = value.split(" ");
  if (parts.length > 1 && articles.includes(parts[0])) {
    return parts.slice(1).join(" ");
  }
  return value;
}

/** Levenshtein distance, capped for early exit on clearly different strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }

  return previous[b.length];
}

export type GradeVerdict = "correct" | "close" | "incorrect";

export interface GradeResult {
  verdict: GradeVerdict;
  /** 0-100. Used for points and stored on the review row. */
  score: number;
  /** The accepted answer the learner came closest to. */
  matched: string | null;
  /** Set when the answer was close enough to accept but not exact. */
  note: string | null;
}

/**
 * Grade a free-text answer against the accepted translations.
 *
 * A "close" verdict covers typos: one or two characters off a real answer is a
 * spelling slip, not a vocabulary failure, and marking it wrong teaches the
 * learner nothing. The threshold scales with word length so "si"/"sa" is not
 * treated as generously as "arrivederci"/"arrivederchi".
 */
export function gradeAnswer(userAnswer: string, accepted: string[]): GradeResult {
  const answer = normalizeAnswer(userAnswer);

  if (!answer) {
    return { verdict: "incorrect", score: 0, matched: null, note: null };
  }

  const candidates = accepted.flatMap((value) => {
    const normalized = normalizeAnswer(value);
    const withoutArticle = stripArticle(normalized);
    return normalized === withoutArticle ? [normalized] : [normalized, withoutArticle];
  });

  const answerWithoutArticle = stripArticle(answer);

  for (const candidate of candidates) {
    if (answer === candidate || answerWithoutArticle === candidate) {
      return { verdict: "correct", score: 100, matched: candidate, note: null };
    }
  }

  // Accept an answer that supplies one of several valid translations plus
  // extra words, e.g. "to fire someone" for "to fire".
  for (const candidate of candidates) {
    if (candidate.length >= 4 && answer.includes(candidate)) {
      return {
        verdict: "correct",
        score: 90,
        matched: candidate,
        note: "Accepted — you included the expected answer.",
      };
    }
  }

  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const distance = editDistance(answer, candidate);
    if (!best || distance < best.distance) best = { candidate, distance };
  }

  if (best) {
    const tolerance = best.candidate.length <= 4 ? 1 : best.candidate.length <= 8 ? 2 : 3;
    if (best.distance <= tolerance) {
      return {
        verdict: "close",
        score: 70,
        matched: best.candidate,
        note: `Close — the expected spelling is "${best.candidate}".`,
      };
    }
  }

  return { verdict: "incorrect", score: 0, matched: null, note: null };
}

/**
 * Points for one graded item.
 *
 * The CLI awards points in two places for the same answer, so a flashcard
 * session inflates the total (issue #10). Here scoring lives in exactly one
 * function and callers only ever record what it returns.
 */
export function pointsForResult(result: GradeResult, difficulty: number): number {
  if (result.verdict === "incorrect") return 0;
  const base = result.verdict === "correct" ? 10 : 5;
  return base + Math.max(0, Math.min(5, difficulty) - 1) * 2;
}
