/**
 * Prompt construction for every activity.
 *
 * Kept in one module so level handling, native-language support, and output
 * format stay consistent. In the CLI each activity builds its own prompt with
 * its own level wording, which is why the same "B1" produces very different
 * difficulty depending on which activity you open.
 */

import { LEVEL_GUIDANCE, LEVEL_LABELS, type Level } from "./levels";
import { languageLabel } from "@/lib/vocab";
import type { VocabWord } from "@/lib/vocab/types";

export interface PromptContext {
  language: string;
  level: Level;
  nativeLanguage: string;
}

function levelPreamble({ language, level, nativeLanguage }: PromptContext): string {
  return [
    `You are an expert ${languageLabel(language)} teacher working with a learner`,
    `at CEFR level ${level.toUpperCase()} (${LEVEL_LABELS[level]}).`,
    `Their native language is ${nativeLanguage}.`,
    "",
    `Level guidance: ${LEVEL_GUIDANCE[level]}`,
  ].join(" ");
}

const JSON_ONLY =
  "Respond with JSON only. No prose before or after, no markdown code fence, " +
  "no explanation of the JSON.";

/** Comma-separated target words, for prompts that should reuse known vocabulary. */
function wordList(words: VocabWord[]): string {
  return words.map((word) => word.word).join(", ");
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export interface ConversationOptions extends PromptContext {
  topic?: string;
  character?: string;
  /** Show a native-language gloss under each reply. */
  bilingual: boolean;
  correctionMode: "none" | "gentle" | "detailed";
}

/**
 * System prompt for conversation practice.
 *
 * Carries over the beginner support added to the CLI in de7a248: at A1/A2 the
 * instructor keeps turns very short, asks one question at a time, and offers a
 * native-language gloss, because a wall of target-language text is where
 * beginners give up.
 */
export function conversationSystemPrompt(options: ConversationOptions): string {
  const { language, level, nativeLanguage, topic, character, bilingual, correctionMode } = options;
  const target = languageLabel(language);

  const lines = [
    levelPreamble(options),
    "",
    `You are having a spoken-style conversation with the learner in ${target}.`,
  ];

  if (character) {
    lines.push(`Stay in character as: ${character}.`);
  }
  if (topic) {
    lines.push(`Keep the conversation on this topic: ${topic}.`);
  }

  lines.push(
    "",
    "Rules:",
    `- Write your side of the conversation in ${target}.`,
    "- Keep every reply to at most 3 sentences. One question per turn.",
    "- Never break character to lecture. You are a conversation partner, not a textbook.",
  );

  if (level === "a1" || level === "a2") {
    lines.push(
      "- This learner is a beginner. Use short, high-frequency sentences.",
      "- Prefer questions they can answer in a few words.",
      "- Reuse vocabulary you have already used in this conversation.",
    );
  }

  if (bilingual) {
    lines.push(
      `- After your ${target} reply, add a line starting exactly with "${nativeLanguage}: " ` +
        `giving a natural ${nativeLanguage} translation of what you just said.`,
    );
  }

  if (correctionMode === "gentle") {
    lines.push(
      `- If the learner makes a mistake, model the correct form naturally in your reply ` +
        `instead of pointing it out. Only name an error if they repeat it three times.`,
    );
  } else if (correctionMode === "detailed") {
    lines.push(
      `- If the learner makes a mistake, add a final line starting exactly with "Correction: " ` +
        `that shows the corrected sentence and names the rule in one clause.`,
    );
  } else {
    lines.push("- Do not correct the learner's mistakes. Just keep the conversation going.");
  }

  return lines.join("\n");
}

/** Ask for a translation of one instructor line, for the on-demand hint button. */
export function translateLinePrompt(
  line: string,
  { language, nativeLanguage }: PromptContext,
): string {
  return (
    `Translate this ${languageLabel(language)} sentence into natural ${nativeLanguage}. ` +
    `Reply with the translation only, no quotes and no commentary.\n\n${line}`
  );
}

// ---------------------------------------------------------------------------
// Fill in the blank
// ---------------------------------------------------------------------------

export function fillBlankPrompt(context: PromptContext, words: VocabWord[], count: number): string {
  const target = languageLabel(context.language);

  return [
    levelPreamble(context),
    "",
    `Write ${count} fill-in-the-blank exercises in ${target}.`,
    `Build them around these words where they fit naturally: ${wordList(words)}.`,
    "",
    "For each exercise:",
    `- "sentence": one ${target} sentence with exactly one blank written as "____".`,
    `- "answer": the single word or short phrase that belongs in the blank.`,
    `- "hint": a short ${context.nativeLanguage} hint that does not give away the answer.`,
    `- "translation": a natural ${context.nativeLanguage} translation of the complete sentence.`,
    "",
    "The blank must have exactly one natural answer. If a sentence would accept",
    "several different words, rewrite it until it does not.",
    "",
    JSON_ONLY,
    'Shape: {"exercises": [{"sentence": "...", "answer": "...", "hint": "...", "translation": "..."}]}',
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

export function translationPrompt(
  context: PromptContext,
  words: VocabWord[],
  count: number,
  direction: "to-target" | "to-native",
): string {
  const target = languageLabel(context.language);
  const from = direction === "to-target" ? context.nativeLanguage : target;
  const to = direction === "to-target" ? target : context.nativeLanguage;

  return [
    levelPreamble(context),
    "",
    `Write ${count} short translation exercises from ${from} into ${to}.`,
    `Draw on these words where they fit naturally: ${wordList(words)}.`,
    "",
    "For each exercise:",
    `- "prompt": the sentence in ${from} for the learner to translate.`,
    `- "answer": the best translation into ${to}.`,
    `- "alternatives": up to 3 other acceptable translations (may be empty).`,
    `- "note": one short sentence on the grammar or word choice being tested.`,
    "",
    JSON_ONLY,
    'Shape: {"exercises": [{"prompt": "...", "answer": "...", "alternatives": ["..."], "note": "..."}]}',
  ].join("\n");
}

/** Grade a free-form translation, where string comparison is not enough. */
export function translationGradePrompt(
  context: PromptContext,
  source: string,
  expected: string,
  userAnswer: string,
): string {
  return [
    levelPreamble(context),
    "",
    "Grade the learner's translation.",
    "",
    `Source: ${source}`,
    `Reference translation: ${expected}`,
    `Learner's translation: ${userAnswer}`,
    "",
    "Judge meaning first: a different wording that conveys the same meaning is",
    "correct. Mark it wrong only if the meaning changed or the grammar is broken.",
    "",
    JSON_ONLY,
    'Shape: {"correct": true, "score": 0-100, "feedback": "one or two sentences", "corrected": "the learner\'s sentence with errors fixed, or null if it was fine"}',
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Generate a passage and its questions in a single call.
 *
 * The CLI regenerated a brand-new passage for every question, so the questions
 * described text the learner never saw (issue #8). Asking for both together is
 * both cheaper and the only way the questions can actually be about the passage.
 */
export function readingPrompt(context: PromptContext, topic: string | undefined, questionCount: number): string {
  const target = languageLabel(context.language);

  return [
    levelPreamble(context),
    "",
    `Write one short ${target} reading passage and ${questionCount} comprehension questions about it.`,
    topic ? `Topic: ${topic}.` : "Choose an everyday topic suitable for this level.",
    "",
    `- "title": a short title in ${target}.`,
    `- "passage": 4-8 sentences in ${target}, appropriate to the level above.`,
    `- "translation": a natural ${context.nativeLanguage} translation of the whole passage.`,
    `- "questions": ${questionCount} multiple-choice questions, each with:`,
    `    "question" (in ${target}), "options" (exactly 4 strings),`,
    `    "answerIndex" (0-3), and "explanation" (in ${context.nativeLanguage}).`,
    "",
    "Every question must be answerable from the passage alone. Do not ask about",
    "anything the passage does not state.",
    "",
    JSON_ONLY,
    'Shape: {"title": "...", "passage": "...", "translation": "...", "questions": [{"question": "...", "options": ["a","b","c","d"], "answerIndex": 0, "explanation": "..."}]}',
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/**
 * Explain a missed flashcard.
 *
 * Only called after a wrong answer — the grading itself is local, so a working
 * flashcard session never depends on the API being up.
 */
export function flashcardFeedbackPrompt(
  context: PromptContext,
  word: VocabWord,
  userAnswer: string,
): string {
  return [
    levelPreamble(context),
    "",
    `The learner was shown the ${languageLabel(context.language)} word "${word.word}"`,
    `and answered "${userAnswer}". The accepted translations are:`,
    word.translations.join(", "),
    "",
    `In at most 2 sentences of ${context.nativeLanguage}, tell them what the word`,
    "actually means and give one memory hook or usage note. Be encouraging and brief.",
    "Reply with the explanation only.",
  ].join("\n");
}
