import "server-only";

/**
 * A language's guided path, built from the compiled curriculum and the
 * vocabulary libraries: every unit's items, and the order to introduce them.
 *
 * Built once per language and kept, like the catalogs it reads.
 */

import { getLesson, getLevelCurriculum } from "@/lib/curriculum";
import { getWords } from "@/lib/vocab";
import { LEVELS } from "@/lib/vocab/types";
import type {
  Course,
  CourseUnit,
  GrammarItem,
  IntroEntry,
  Item,
  PhraseItem,
  WordItem,
} from "./types";

/** New words and phrases are introduced a few at a time. */
const WORD_BATCH = 3;
const PHRASE_BATCH = 2;

const cache = new Map<string, Course>();

export function getCourse(language: string): Course {
  const key = language.toLowerCase();
  let course = cache.get(key);
  if (!course) {
    course = buildCourse(key);
    cache.set(key, course);
  }
  return course;
}

/** Lower-case, single-spaced, accents kept: è and e are different words. */
export function wordKey(language: string, target: string): string {
  return `w:${language}:${target.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** "il / la" is answered by either; "un po'" stays whole. */
function typedForms(target: string): string[] {
  const parts = target.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? [target, ...parts] : [target];
}

/** "from, of" → ["from, of", "from", "of"], so no distractor means "from" either. */
function meaningsOf(english: string[]): string[] {
  return [
    ...new Set(
      english.flatMap((meaning) => [
        meaning,
        ...meaning
          .replace(/\([^)]*\)/g, "")
          .split(/[,;/]/)
          .map((part) => part.trim())
          .filter(Boolean),
      ]),
    ),
  ];
}

/** Text without case or punctuation: "Ciao!" the phrase and "ciao" the word are the same thing. */
function plainText(text: string): string {
  return text.toLowerCase().replace(/[¡!¿?.,…:;"“”]/g, "").replace(/\s+/g, " ").trim();
}

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Spread `extras` evenly through `main`, keeping both in order. */
function interleave<T>(main: T[], extras: T[]): T[] {
  const out: T[] = [];
  let m = 0;
  let e = 0;
  while (m < main.length || e < extras.length) {
    const mainShare = main.length === 0 ? 1 : m / main.length;
    const extraShare = extras.length === 0 ? 1 : e / extras.length;
    if (m < main.length && (mainShare <= extraShare || e >= extras.length)) out.push(main[m++]);
    else out.push(extras[e++]);
  }
  return out;
}

/** Plain, lower-case text of a lesson section, for finding which words it shows. */
function sectionText(section: { body: string; table?: { rows: string[][] }; examples?: [string, string][]; tip?: string }): string {
  return [
    section.body,
    ...(section.table?.rows.flat() ?? []),
    ...(section.examples?.map(([target]) => target) ?? []),
    section.tip ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function mentions(text: string, word: string): boolean {
  const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u").test(text);
}

function buildCourse(language: string): Course {
  const items = new Map<string, Item>();
  const units: CourseUnit[] = [];
  /** Plain text of every word and phrase so far, so nothing is taught twice. */
  const taught = new Set<string>();

  for (const level of LEVELS) {
    const curriculum = getLevelCurriculum(language, level);
    if (!curriculum || curriculum.units.length === 0) continue;

    const library = getWords(language, level);

    for (const unit of curriculum.units) {
      const unitIndex = units.length;
      const itemKeys: string[] = [];
      const add = (item: Item) => {
        items.set(item.key, item);
        itemKeys.push(item.key);
        if (item.kind !== "grammar") taught.add(plainText(item.target));
      };

      // Lessons: each section is an idea, followed by the lesson's words it shows.
      const lessonEntries: IntroEntry[] = [];
      for (const lessonId of unit.lessonIds) {
        const lesson = getLesson(lessonId);
        if (!lesson) continue;

        const texts = lesson.sections.map(sectionText);
        const wordsBySection: WordItem[][] = lesson.sections.map(() => []);

        for (const [target, english] of lesson.words) {
          const key = wordKey(language, target);
          if (items.has(key) || taught.has(plainText(target))) continue;
          const shownIn = texts.findIndex((text) => typedForms(target).some((form) => mentions(text, form)));
          const word: WordItem = {
            kind: "word",
            key,
            unitIndex,
            target,
            accepted: typedForms(target),
            english,
            meanings: meaningsOf([english]),
            group: lesson.id,
          };
          add(word);
          wordsBySection[shownIn === -1 ? lesson.sections.length - 1 : shownIn].push(word);
        }

        lesson.sections.forEach((section, index) => {
          const grammar: GrammarItem = {
            kind: "grammar",
            key: `g:${lesson.id}#${index + 1}`,
            unitIndex,
            lessonId: lesson.id,
            section: index + 1,
            heading: section.heading,
            questions: lesson.practice
              .map((question, questionIndex) => ({ index: questionIndex, type: question.type, section: question.section }))
              .filter((question) => question.section === index + 1)
              .map(({ index: questionIndex, type }) => ({ index: questionIndex, type })),
          };
          add(grammar);
          lessonEntries.push({ type: "grammar", key: grammar.key });
          for (const batch of batches(wordsBySection[index], WORD_BATCH)) {
            lessonEntries.push({ type: "words", keys: batch.map((word) => word.key) });
          }
        });
      }

      // Phrases from the unit's phrasebook situations.
      const phraseEntries: IntroEntry[] = [];
      for (const situationId of unit.situationIds) {
        const situation = curriculum.situations.find((candidate) => candidate.id === situationId);
        if (!situation) continue;
        const phrases: PhraseItem[] = situation.phrases
          .filter((phrase) => !taught.has(plainText(phrase.display)))
          .map((phrase) => ({
            kind: "phrase",
            key: `p:${phrase.id}`,
            unitIndex,
            phraseId: phrase.id,
            target: phrase.display,
            accepted: phrase.target,
            english: phrase.english[0],
            meanings: meaningsOf(phrase.english),
            group: situationId,
          }));
        phrases.forEach(add);
        for (const batch of batches(phrases, PHRASE_BATCH)) {
          phraseEntries.push({ type: "phrases", keys: batch.map((phrase) => phrase.key) });
        }
      }

      // Library words in the unit's categories, unless a lesson already taught them.
      const libraryWords: WordItem[] = [];
      for (const entry of library) {
        if (!unit.categories.includes(entry.category)) continue;
        const key = wordKey(language, entry.word);
        if (items.has(key) || taught.has(plainText(entry.word)) || entry.translations.length === 0) {
          continue;
        }
        const word: WordItem = {
          kind: "word",
          key,
          unitIndex,
          target: entry.word,
          accepted: typedForms(entry.word),
          english: entry.translations[0],
          meanings: meaningsOf(entry.translations),
          group: entry.category,
        };
        add(word);
        libraryWords.push(word);
      }
      const libraryEntries: IntroEntry[] = batches(libraryWords, WORD_BATCH).map((batch) => ({
        type: "words",
        keys: batch.map((word) => word.key),
      }));

      units.push({
        id: unit.id,
        level,
        number: unit.number,
        title: unit.title,
        lessonIds: unit.lessonIds,
        itemKeys,
        intro: interleave(lessonEntries, interleave(phraseEntries, libraryEntries)),
      });
    }
  }

  return { language, units, items };
}
