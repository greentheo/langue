/**
 * Answer grading.
 *
 * Deliberately local and deterministic: asking the model to grade "does 'hello'
 * match 'ciao'?" costs a round trip and a token bill for something string
 * comparison answers correctly, and it makes flashcards unusable when the API
 * is down. The model is reserved for work only it can do — generating content
 * and explaining mistakes.
 */

import { endingOf, isKnownForm, keepsEnding } from "./endings";
import { accentPair, glossOf, isKnownWrittenForm } from "./forms";
import { normalizeAnswer, normalizeKeepingAccents } from "./normalize";

export { normalizeAnswer, normalizeKeepingAccents };

/**
 * Expand English contractions so "what's your name" and "what is your name"
 * compare equal. Applied to both sides, so ambiguous expansions ("he'd") are
 * harmless: the answer and the key are rewritten the same way.
 */
export function expandContractions(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/\bcan't\b/gi, "can not")
    .replace(/\bcannot\b/gi, "can not")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bshan't\b/gi, "shall not")
    .replace(/\blet's\b/gi, "let us")
    .replace(/\b(\w+)n't\b/gi, "$1 not")
    .replace(/\b(\w+)'re\b/gi, "$1 are")
    .replace(/\b(\w+)'m\b/gi, "$1 am")
    .replace(/\b(\w+)'ve\b/gi, "$1 have")
    .replace(/\b(\w+)'ll\b/gi, "$1 will")
    .replace(/\b(\w+)'d\b/gi, "$1 would")
    .replace(/\b(\w+)'s\b/gi, "$1 is");
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

/**
 * Drop a leading article only from a noun on its own: "il cane" → "cane". In
 * a longer answer a leading "le", "lo" or "la" may be a pronoun — "Le regalo
 * un libro" is not "Gli regalo un libro" — so the target language keeps it.
 */
export function stripNounArticle(value: string): string {
  return value.split(" ").length === 2 ? stripArticle(value) : value;
}

/**
 * Subject pronouns a learner may add in front of an answer that leaves them
 * out: "io sono stanco" for "sono stanco". (French needs its pronouns, so
 * they are always in the accepted answer already.)
 */
const SUBJECT_PRONOUNS = new Set([
  // Italian
  "io", "tu", "lui", "lei", "noi", "voi", "loro",
  // Spanish
  "yo", "tu", "el", "ella", "usted", "nosotros", "nosotras", "vosotros", "vosotras", "ellos", "ellas", "ustedes",
  // Portuguese
  "eu", "voce", "ele", "ela", "nos", "voces", "eles", "elas",
]);

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
  /** Set when the answer was close enough to accept but not exact, or missed only an ending. */
  note: string | null;
  /**
   * A near miss rejected because a word's ending was wrong: another real form
   * of the word ("comemos" for "comimos"), or a slip that makes no word.
   */
  endingMiss?: "otherForm" | "misspelt";
  /**
   * An answer right only once accents are ignored: the missing accent made
   * another form of the word ("parle" for "parlé"), a different word ("e" for
   * "è"), or no word at all (still close: "perche" for "perché").
   */
  accentMiss?: "otherForm" | "otherWord" | "plain";
}

/** How lenient a grade is. The defaults suit English answers. */
export interface GradeOptions {
  /**
   * Extra words around a right answer: "any" (English: "to fire someone" for
   * "to fire"), "pronoun" (only a subject pronoun in front: "io sono stanco"),
   * or "none".
   */
  extraWords?: "any" | "pronoun" | "none";
  /**
   * Drop a leading article only from a noun on its own — for the target
   * language, where the same little words are also pronouns.
   */
  nounArticlesOnly?: boolean;
  /** Accept a typo or two as close. Off where one letter is the whole point, as in a conjugation. */
  typos?: boolean;
  /**
   * A typo must leave a word's last letter alone. In the target language the
   * end of a word is its grammar — stanco/stanca, parlo/parla — so a slip
   * there is the mistake, not a typo.
   */
  keepEndings?: boolean;
  /** The target language, whose endings keepEndings protects (endings.ts). */
  language?: string;
  /**
   * Rewrites both sides before comparing — English expands contractions. Notes
   * still quote the accepted answer as written.
   */
  rewrite?: (value: string) => string;
}

/** How a near miss relates to an accepted answer: a typo, or a slip in a word's ending (which word, as typed). */
type Slip = { kind: "typo" } | { kind: "ending"; typed: string; index: number } | null;

/**
 * Is `answer` a typo of `candidate`? Word by word: the same number of words,
 * short words (three letters or fewer) exactly right, at most two longer
 * words a letter or two off — the allowance growing with the word. With an
 * endings language, a slip that changes a word's ending (endings.ts) is not a
 * typo but an ending slip: the ending is the grammar.
 */
function slipOf(answer: string, candidate: string, endings: string | null): Slip {
  const typed = answer.split(" ");
  const expected = candidate.split(" ");
  if (typed.length !== expected.length) return null;

  let slips = 0;
  let ending: { typed: string; index: number } | null = null;
  for (let i = 0; i < expected.length; i += 1) {
    const [a, b] = [typed[i], expected[i]];
    if (a === b) continue;
    if (a.length <= 3 || b.length <= 3) return null;
    const tolerance = b.length <= 5 ? 1 : b.length <= 9 ? 2 : 3;
    if (editDistance(a, b) > tolerance) return null;
    if (endings !== null && !keepsEnding(a, b, endings)) ending ??= { typed: a, index: i };
    slips += 1;
  }
  if (slips === 0 || slips > 2) return null;
  return ending ? { kind: "ending", ...ending } : { kind: "typo" };
}

/** Word `index` of a normalized form, as the accepted answer writes it ("Comimos", "arrivée"). */
function writtenWord(written: string, form: string, index: number): string {
  const words = written
    .replace(/[-‐–—]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  const formWords = form.split(" ");
  // A form without its article has one word fewer than the answer as written.
  const offset = words.length - formWords.length;
  return (offset >= 0 ? words[index + offset] : undefined) ?? formWords[index];
}

/** Does `text` contain `phrase` as whole words? Both normalized. */
function hasWords(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

/**
 * Grade a free-text answer against the accepted translations.
 *
 * A "close" verdict covers typos: one or two characters off a real answer is a
 * spelling slip, not a vocabulary failure, and marking it wrong teaches the
 * learner nothing. The threshold scales with word length, and words of three
 * letters or fewer get none — "lo" and "la" are different words, not a typo.
 */
export function gradeAnswer(userAnswer: string, accepted: string[], options: GradeOptions = {}): GradeResult {
  const { extraWords = "any", nounArticlesOnly = false, typos = true, keepEndings = false, language, rewrite } = options;
  const strip = nounArticlesOnly ? stripNounArticle : stripArticle;
  const prepare = (value: string) => normalizeAnswer(rewrite ? rewrite(value) : value);
  const answer = prepare(userAnswer);

  if (!answer) {
    return { verdict: "incorrect", score: 0, matched: null, note: null };
  }

  // Each form to compare against, with the accepted answer it came from as
  // written: a note quotes "téléphone", never the comparison form "telephone".
  const candidates = accepted.flatMap((written) => {
    const normalized = prepare(written);
    const withoutArticle = strip(normalized);
    const forms = normalized === withoutArticle ? [normalized] : [normalized, withoutArticle];
    return forms.map((form) => ({ form, written }));
  });

  const answerWithoutArticle = strip(answer);
  const [first, ...rest] = answer.split(" ");
  const answerWithoutPronoun = extraWords !== "none" && SUBJECT_PRONOUNS.has(first) ? rest.join(" ") : null;

  for (const { form } of candidates) {
    if (answer === form || answerWithoutArticle === form || answerWithoutPronoun === form) {
      return { verdict: "correct", score: 100, matched: form, note: null };
    }
  }

  // Accept an answer that supplies one of several valid translations plus
  // extra words, e.g. "to fire someone" for "to fire" — whole words only, so
  // "conosciamo" is not "conosci".
  if (extraWords === "any") {
    for (const { form } of candidates) {
      if (form.length >= 4 && hasWords(answer, form)) {
        return {
          verdict: "correct",
          score: 90,
          matched: form,
          note: "Accepted — you included the expected answer.",
        };
      }
    }
  }

  // A near miss of an accepted answer: with or without an added subject pronoun.
  const endings = keepEndings ? (language ?? "") : null;
  const near = typos
    ? candidates.map((candidate) => {
        const slips = [slipOf(answer, candidate.form, endings)];
        if (answerWithoutPronoun !== null) slips.push(slipOf(answerWithoutPronoun, candidate.form, endings));
        return { ...candidate, slip: slips.find((slip) => slip?.kind === "typo") ?? slips.find(Boolean) ?? null };
      })
    : [];

  const typo = near.find(({ slip }) => slip?.kind === "typo");
  if (typo) {
    return {
      verdict: "close",
      score: 70,
      matched: typo.form,
      note: `Close — the expected spelling is "${typo.written}".`,
    };
  }

  // Close enough for a typo, but a word's ending changed: the grammar is wrong, and the learner reads why.
  const miss = near.find(({ slip }) => slip?.kind === "ending");
  if (miss?.slip?.kind === "ending") {
    const word = writtenWord(miss.written, miss.form, miss.slip.index);
    const otherForm = isKnownForm(miss.slip.typed, language ?? "");
    return {
      verdict: "incorrect",
      score: 0,
      matched: miss.form,
      note: otherForm
        ? `That's another form — check the ending: «${word}».`
        : `Check the spelling of the ending: «${word}».`,
      endingMiss: otherForm ? "otherForm" : "misspelt",
    };
  }

  return { verdict: "incorrect", score: 0, matched: null, note: null };
}

/** Which language the learner is typing in, for language-specific leniency. */
export type AnswerLanguage = "english" | "target";

/**
 * Grade an English answer: contractions are expanded on both sides first, so
 * "I'm tired" and "I am tired" are the same answer.
 */
export function gradeEnglishAnswer(userAnswer: string, accepted: string[]): GradeResult {
  return gradeAnswer(userAnswer, accepted, { rewrite: expandContractions });
}

/** The target language: no extra words but a subject pronoun, articles only off a lone noun. */
const TARGET: GradeOptions = { extraWords: "pronoun", nounArticlesOnly: true, typos: true, keepEndings: true };

/** The same leniency as gradeAnswer's exact matches, but accents count. */
function matchesKeepingAccents(userAnswer: string, accepted: string[], options: GradeOptions): boolean {
  const strip = options.nounArticlesOnly ? stripNounArticle : stripArticle;
  const typed = normalizeKeepingAccents(userAnswer);
  const [first, ...rest] = typed.split(" ");
  const variants = [typed, strip(typed)];
  if (options.extraWords !== "none" && SUBJECT_PRONOUNS.has(normalizeAnswer(first))) variants.push(rest.join(" "));

  return accepted.some((value) => {
    const candidate = normalizeKeepingAccents(value);
    return [candidate, strip(candidate)].some(
      (form) =>
        variants.includes(form) || (options.extraWords !== "pronoun" && options.extraWords !== "none" && form.length >= 4 && hasWords(typed, form)),
    );
  });
}

/**
 * Grade a target-language answer, where accents carry meaning.
 *
 * gradeAnswer ignores accents, which is right for English and for recognising
 * a word, but in Italian *e* is "and" and *è* is "is". An answer that is only
 * correct once accents are stripped is graded *close*, with the accented form
 * shown, rather than silently right or harshly wrong — typing accents on an
 * English keyboard is hard, and the learner should see what they missed.
 *
 * `language` is the course language: its endings decide which slips are
 * typos and which are grammar (endings.ts).
 */
export function gradeTargetAnswer(
  userAnswer: string,
  accepted: string[],
  language: string,
  overrides: GradeOptions = {},
): GradeResult {
  const options = { ...TARGET, language, ...overrides };
  const result = gradeAnswer(userAnswer, accepted, options);
  if (result.verdict !== "correct") return result;

  // Right once accents are ignored; is it right with them?
  if (matchesKeepingAccents(userAnswer, accepted, options)) return result;

  const intended =
    accepted.find((value) => gradeAnswer(userAnswer, [value], options).verdict === "correct") ??
    accepted[0];

  // Where accents carry meaning they are never stripped (#114): a missing accent that leaves another real word is a mistake.
  const changed = accentChangesWord(userAnswer, intended, language);
  if (changed) return { verdict: "incorrect", score: 0, matched: result.matched, note: changed.note, accentMiss: changed.kind };

  return {
    verdict: "close",
    score: 80,
    matched: result.matched,
    note: `Watch the accents: "${intended}".`,
    accentMiss: "plain",
  };
}

/** Languages where a capital is often written without its accent (#120 re-check): French print, Italian keyboards. */
const BARE_CAPITALS = new Set(["french", "italian"]);

/** A word this short is a word of its own, not a stem and an ending: è/e, tú/tu, está/esta, pôde/pode. */
const SHORT_WORD = 4;

/** An answer's words as written, without the punctuation around them: "J'ai parlé." → ["J'ai", "parlé"]. */
function writtenWords(value: string): string[] {
  return value
    .replace(/[-‐–—]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

/**
 * Does a typed word differ from the intended one only in its accents, and is
 * it, as typed, a word the course uses? Then the accent changed the word. In
 * the word's ending it's another form of it (parle for parlé, hablo for
 * habló); elsewhere, or in a short word, a different word (e for è, tu for tú),
 * unless the short-word table says it's a form (pode for pôde).
 *
 * In French and Italian, a capital typed without its accent stays a slip:
 * French print often leaves capitals bare, and Italian keyboards have no È
 * ("A demain", "E stanco"). Spanish and Portuguese keyboards have É, and
 * their spelling keeps it, so there a capital follows the ordinary rule.
 */
function accentChangesWord(
  typed: string,
  intended: string,
  language: string,
): { kind: "otherForm" | "otherWord"; note: string } | null {
  const intendedWords = writtenWords(intended);
  for (const typedWord of writtenWords(typed)) {
    const asTyped = normalizeKeepingAccents(typedWord);
    const match = intendedWords.find(
      (word) => normalizeAnswer(word) === normalizeAnswer(typedWord) && normalizeKeepingAccents(word) !== asTyped,
    );
    if (!match) continue;

    const expected = normalizeKeepingAccents(match);
    const [letters, typedLetters, written] = [[...expected], [...asTyped], [...typedWord.normalize("NFC")]];
    const sameLength = letters.length === typedLetters.length;
    const differ = letters.flatMap((letter, i) => (letter !== typedLetters[i] ? [i] : []));
    const onCapitals = sameLength && written.length === letters.length && differ.every((i) => written[i] !== written[i].toLowerCase());
    if (onCapitals && BARE_CAPITALS.has(language)) continue;

    const pair = accentPair(expected, asTyped, language);
    if (pair) {
      const kind = pair.kind === "form" ? "another form" : "a different word";
      return {
        kind: pair.kind === "form" ? "otherForm" : "otherWord",
        note: `That's ${kind} — «${match}» (${pair.accented}), not «${typedWord}» (${pair.plain}).`,
      };
    }
    if (!isKnownWrittenForm(asTyped, language)) continue;

    const ending = endingOf(normalizeAnswer(match), language).length;
    const inEnding = sameLength && differ.every((i) => i >= letters.length - ending);
    if (inEnding && letters.length > SHORT_WORD) {
      return { kind: "otherForm", note: `That's another form — the accent is the grammar here: «${intended}».` };
    }
    const [meant, said] = [glossOf(expected, language), glossOf(asTyped, language)];
    const both = meant && said;
    return {
      kind: "otherWord",
      note: `That's a different word — «${match}»${both ? ` (${meant})` : ""}, not «${typedWord}»${both ? ` (${said})` : ""}.`,
    };
  }
  return null;
}

/** Grade in whichever language the learner is typing. */
export function gradeIn(
  language: AnswerLanguage,
  userAnswer: string,
  accepted: string[],
  target: string,
): GradeResult {
  return language === "english"
    ? gradeEnglishAnswer(userAnswer, accepted)
    : gradeTargetAnswer(userAnswer, accepted, target);
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
