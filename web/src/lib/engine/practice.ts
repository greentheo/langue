/**
 * Grading for lesson practice items.
 *
 * Pure (no database, no catalog import), so it can be unit-tested directly and
 * used by any route that grades curriculum items.
 */

import {
  gradeEnglishAnswer,
  gradeTargetAnswer,
  normalizeKeepingAccents,
  pointsForResult,
  stripNounArticle,
  type GradeResult,
} from "./grade";
import type { PracticeItem } from "@/lib/curriculum/schema";
import { LEVELS, type Level } from "@/lib/vocab/types";

/** The accepted answers for an item, and which language they are in. */
export function acceptedAnswers(item: PracticeItem): {
  answers: string[];
  language: "english" | "target";
} {
  switch (item.type) {
    case "choice":
      return { answers: [item.answer], language: "target" };
    case "fill":
      return { answers: item.answers, language: "target" };
    case "translate":
      return {
        answers: item.answers,
        language: item.direction === "to-english" ? "english" : "target",
      };
  }
}

const RIGHT: GradeResult = { verdict: "correct", score: 100, matched: null, note: null };
const WRONG: GradeResult = { verdict: "incorrect", score: 0, matched: null, note: null };

/**
 * Right or wrong, accents included — for items whose whole point is the
 * accent. Case, punctuation and a leading article still
 * do not matter.
 */
function exactMatch(answer: string, accepted: string[]): GradeResult {
  const typed = normalizeKeepingAccents(answer);
  const hit = accepted.some((value) => {
    const candidate = normalizeKeepingAccents(value);
    return typed === candidate || stripNounArticle(typed) === stripNounArticle(candidate);
  });
  return hit ? RIGHT : WRONG;
}

/** Points scale with level, as flashcard points scale with word difficulty. */
export function difficultyForLevel(level: string): number {
  return Math.max(1, LEVELS.indexOf(level as Level) + 1);
}

export interface ItemGrade {
  verdict: GradeResult["verdict"];
  score: number;
  points: number;
  note: string | null;
  /** Every accepted answer, revealed only after grading. */
  answers: string[];
  why: string;
}

/**
 * Grade one practice item.
 *
 * Multiple choice is an exact match on the option clicked — "close" makes no
 * sense for a click. Typed answers use the language-aware grader: English is
 * contraction-tolerant, the target language is accent-sensitive. A
 * fill-in-the-blank gets no typo allowance: the blank is usually an ending
 * or a little word ("parlo" or "parla", "lo" or "la"), so one letter off is
 * the mistake the question is about.
 */
export function gradePracticeItem(item: PracticeItem, answer: string, level: string): ItemGrade {
  const { answers, language } = acceptedAnswers(item);

  const result: GradeResult =
    item.type === "choice"
      ? // The browser sends the clicked option verbatim, and some options differ
        // only in capitals or accents ("Lunedì" vs "lunedì"), so compare exactly.
        answer.trim() === item.answer.trim()
        ? RIGHT
        : WRONG
      : item.strict_accents
        ? exactMatch(answer, answers)
        : language === "english"
          ? gradeEnglishAnswer(answer, answers)
          : gradeTargetAnswer(answer, answers, item.type === "fill" ? { typos: false } : {});

  return {
    verdict: result.verdict,
    score: result.score,
    points: pointsForResult(result, difficultyForLevel(level)),
    note: result.note,
    answers,
    why: item.why,
  };
}

