/**
 * Multiple-choice options for a flashcard.
 *
 * The wrong options come from other words in the learner's pool, preferring
 * the same category so the choice cannot be made on topic alone ("which of
 * these is a food?"). A distractor is rejected if any of its meanings is also
 * a meaning of the card — two words that both mean "hello" would make the
 * card unanswerable.
 */

import { normalizeAnswer } from "./grade";
import { sampleWords } from "@/lib/vocab";
import type { VocabWord } from "@/lib/vocab/types";

export function buildChoices(card: VocabWord, pool: VocabWord[], optionCount = 4): string[] {
  const correct = card.translations[0];
  const cardMeanings = new Set(card.translations.map(normalizeAnswer));
  const used = new Set([normalizeAnswer(correct)]);

  const eligible = (word: VocabWord) =>
    word.word !== card.word &&
    word.translations.length > 0 &&
    !word.translations.some((meaning) => cardMeanings.has(normalizeAnswer(meaning)));

  const sameCategory = pool.filter((word) => word.category === card.category && eligible(word));
  const others = pool.filter((word) => word.category !== card.category && eligible(word));

  const distractors: string[] = [];
  for (const word of [...sampleWords(sameCategory, sameCategory.length), ...sampleWords(others, others.length)]) {
    if (distractors.length >= optionCount - 1) break;
    const option = word.translations[0];
    const key = normalizeAnswer(option);
    if (used.has(key)) continue;
    used.add(key);
    distractors.push(option);
  }

  return sampleWords([correct, ...distractors], distractors.length + 1);
}
