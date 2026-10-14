import "server-only";

/**
 * A language's guided path, built from the compiled curriculum and the
 * vocabulary libraries: every unit's items, the order to introduce them, the
 * sentences they appear in, and the role-plays that use them.
 *
 * Built once per language and kept, like the catalogs it reads.
 */

import { getLesson, getLevelCurriculum } from "@/lib/curriculum";
import type { Dialogue } from "@/lib/curriculum/types";
import { normalizeAnswer, normalizeKeepingAccents, stripArticle } from "@/lib/engine/grade";
import { getWords } from "@/lib/vocab";
import { LEVELS } from "@/lib/vocab/types";
import { blankOut, buildable, tilesOf } from "./sentences";
import type {
  Course,
  CourseDialogue,
  CourseUnit,
  GrammarItem,
  IntroEntry,
  Item,
  PhraseItem,
  Sentence,
  WordItem,
} from "./types";

/** New words and phrases are introduced a few at a time. */
const WORD_BATCH = 3;
const PHRASE_BATCH = 2;
/** Sentences kept per word for fill-in-the-blank, best first. */
const MAX_CLOZES = 6;
/** Words this short ("a", "di", "un") are in every sentence; a role-play turn does not practise them. */
const MIN_TAGGED_LENGTH = 3;

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

/** What the course has taught so far, so nothing is taught twice. */
class Taught {
  private seen = new Map<string, { kind: "word" | "phrase"; meanings: Set<string> }[]>();

  /** Each way of writing it, without an article: "le livre" and "livre" are one word. */
  private keys(forms: string[]): string[] {
    return [...new Set(forms.flatMap(typedForms).map((form) => stripArticle(plainText(form))))];
  }

  private meanings(english: string[]): Set<string> {
    return new Set(meaningsOf(english).map((meaning) => stripArticle(normalizeAnswer(meaning))));
  }

  add(kind: "word" | "phrase", forms: string[], english: string[]): void {
    const entry = { kind, meanings: this.meanings(english) };
    for (const key of this.keys(forms)) this.seen.set(key, [...(this.seen.get(key) ?? []), entry]);
  }

  /**
   * Already taught: the same word written the same way, or a phrase that says
   * the same thing as a word ("Ciao!" after "ciao"). A phrase that only looks
   * like a word — "Santé !" (cheers) after "santé" (health) — is new.
   */
  has(kind: "word" | "phrase", forms: string[], english: string[]): boolean {
    const meanings = this.meanings(english);
    return this.keys(forms).some((key) =>
      (this.seen.get(key) ?? []).some(
        (entry) => entry.kind === kind || [...meanings].some((meaning) => entry.meanings.has(meaning)),
      ),
    );
  }
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
  const sentences = new Map<string, Sentence>();
  const scripts: { dialogue: Dialogue; unitIndex: number }[] = [];
  const taught = new Taught();

  for (const level of LEVELS) {
    const curriculum = getLevelCurriculum(language, level);
    if (!curriculum || curriculum.units.length === 0) continue;

    const library = getWords(language, level);
    const unitOffset = units.length;
    for (const dialogue of curriculum.dialogues ?? []) {
      scripts.push({ dialogue, unitIndex: unitOffset + dialogue.unit - 1 });
    }

    for (const unit of curriculum.units) {
      const unitIndex = units.length;
      const itemKeys: string[] = [];
      const add = (item: Item) => {
        items.set(item.key, item);
        itemKeys.push(item.key);
        if (item.kind !== "grammar") taught.add(item.kind, [item.target, ...item.accepted], item.meanings);
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
          if (items.has(key) || taught.has("word", [target], [english])) continue;
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
            ladder: [],
            clozes: [],
            replies: [],
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
            builds: [],
          };
          (section.examples ?? []).forEach(([target, english], exampleIndex) => {
            const id = `s:${lesson.id}#${index + 1}.${exampleIndex + 1}`;
            sentences.set(id, { id, target, english, group: lesson.id, unitIndex });
            if (buildable(target)) grammar.builds.push(id);
          });
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
          .filter((phrase) => !taught.has("phrase", [phrase.display, ...phrase.target], phrase.english))
          .map((phrase) => {
            const id = `s:p:${phrase.id}`;
            sentences.set(id, {
              id,
              target: phrase.target[0],
              english: phrase.english[0],
              group: situationId,
              unitIndex,
            });
            return {
              kind: "phrase",
              key: `p:${phrase.id}`,
              unitIndex,
              phraseId: phrase.id,
              target: phrase.display,
              accepted: phrase.target,
              english: phrase.english[0],
              meanings: meaningsOf(phrase.english),
              group: situationId,
              ladder: [],
              build: buildable(phrase.target[0]) ? id : null,
              replies: [],
            };
          });
        phrases.forEach(add);
        for (const batch of batches(phrases, PHRASE_BATCH)) {
          phraseEntries.push({ type: "phrases", keys: batch.map((phrase) => phrase.key) });
        }
      }

      // Library words in the unit's categories, unless a lesson already taught them.
      const libraryWords: WordItem[] = [];
      for (const entry of library) {
        if (!unit.categories.includes(entry.category)) continue;
        entry.examples.forEach((target, exampleIndex) => {
          const id = `s:w:${language}:${entry.word.toLowerCase()}#${exampleIndex + 1}`;
          const english = entry.examples_en?.[exampleIndex] ?? null;
          sentences.set(id, { id, target, english, group: entry.category, unitIndex });
        });
        const key = wordKey(language, entry.word);
        if (items.has(key) || taught.has("word", [entry.word], entry.translations) || entry.translations.length === 0) {
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
          ladder: [],
          clozes: [],
          replies: [],
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

  const index = indexSentences(sentences);
  for (const item of items.values()) {
    if (item.kind === "word") item.clozes = clozesFor(item, index);
  }
  const dialogues = new Map<string, CourseDialogue>();
  for (const { dialogue, unitIndex } of scripts) {
    if (unitIndex >= units.length) continue;
    const built = buildDialogue(dialogue, unitIndex, items);
    dialogues.set(built.key, built);
  }
  for (const item of items.values()) {
    if (item.kind === "word") {
      item.ladder = [
        "recognize",
        "recall",
        "type",
        ...(item.clozes.length > 0 ? (["cloze"] as const) : []),
        ...(item.replies.length > 0 ? (["reply"] as const) : []),
      ];
    } else if (item.kind === "phrase") {
      item.ladder = [
        "recognize",
        "recall",
        ...(item.build ? (["build"] as const) : []),
        "type",
        ...(item.replies.length > 0 ? (["reply"] as const) : []),
      ];
    }
  }

  return { language, units, items, sentences, dialogues };
}

interface IndexedSentence {
  sentence: Sentence;
  /** Its words, lower-case, for a quick look before the exact match. */
  words: Set<string>;
  lower: string;
  plain: string;
}

/** Sentences long enough to blank a word out of, with their words looked up once. */
function indexSentences(sentences: Map<string, Sentence>): IndexedSentence[] {
  return [...sentences.values()].flatMap((sentence) => {
    const tiles = tilesOf(sentence.target);
    if (tiles.length < 3) return [];
    return [
      {
        sentence,
        words: new Set(tiles.map((tile) => tile.toLowerCase())),
        lower: sentence.target.toLowerCase(),
        plain: normalizeAnswer(sentence.target),
      },
    ];
  });
}

/**
 * Sentences a word can be blanked out of: ones the learner can read by then
 * (from its unit or the next), not the word on its own, translated ones first.
 */
function clozesFor(word: WordItem, sentences: IndexedSentence[]): string[] {
  const own = normalizeAnswer(word.target);
  const forms = word.accepted.map((form) => form.trim().toLowerCase()).filter(Boolean);
  // Cheap checks first; blankOut has the final say on word boundaries.
  const mayContain = (entry: IndexedSentence) =>
    forms.some((form) => (form.includes(" ") || form.includes("'") ? entry.lower.includes(form) : entry.words.has(form)));
  return sentences
    .filter(
      (entry) =>
        entry.sentence.unitIndex <= word.unitIndex + 1 &&
        entry.plain !== own &&
        mayContain(entry) &&
        blankOut(entry.sentence.target, word.accepted) !== null,
    )
    .map((entry) => entry.sentence)
    .sort(
      (a, b) =>
        Number(a.english === null) - Number(b.english === null) ||
        Math.abs(a.unitIndex - word.unitIndex) - Math.abs(b.unitIndex - word.unitIndex),
    )
    .slice(0, MAX_CLOZES)
    .map((sentence) => sentence.id);
}

/** Does `text` contain `phrase` as whole words? Both already normalized. */
function containsWords(text: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${text} `.includes(` ${phrase} `);
}

const taggableCache = new WeakMap<Map<string, Item>, { item: WordItem | PhraseItem; forms: string[] }[]>();

/**
 * Words and phrases a role-play turn can be tagged with, with their forms
 * normalized once: phrases compared without accents (they are whole
 * sentences), words with them (è is not e), and words too short to mean
 * anything on their own left out.
 */
function taggable(items: Map<string, Item>): { item: WordItem | PhraseItem; forms: string[] }[] {
  let cached = taggableCache.get(items);
  if (!cached) {
    cached = [...items.values()].flatMap((item) => {
      if (item.kind === "grammar") return [];
      const forms =
        item.kind === "phrase"
          ? item.accepted.map(normalizeAnswer)
          : item.accepted
              .filter((form) => form.replace(/[^\p{L}]/gu, "").length >= MIN_TAGGED_LENGTH)
              .map(normalizeKeepingAccents);
      return forms.length > 0 ? [{ item, forms }] : [];
    });
    taggableCache.set(items, cached);
  }
  return cached;
}

/**
 * A role-play as the path uses it. Each of the learner's turns is tagged with
 * the words and phrases its model answer says — taught by the dialogue's unit
 * — and those items learn which turns can practise them.
 */
function buildDialogue(dialogue: Dialogue, unitIndex: number, items: Map<string, Item>): CourseDialogue {
  const key = `d:${dialogue.id}`;
  const candidates = taggable(items).filter((candidate) => candidate.item.unitIndex <= unitIndex);
  const all = new Set<string>();

  const lines = dialogue.lines.map((line, lineIndex) => {
    if ("them" in line) return { kind: "them" as const, target: line.them, english: line.english };

    const plain = normalizeAnswer(line.answers[0]);
    const accented = normalizeKeepingAccents(line.answers[0]);
    const itemKeys = candidates
      .filter(({ item, forms }) => forms.some((form) => containsWords(item.kind === "phrase" ? plain : accented, form)))
      .map(({ item }) => {
        item.replies.push({ dialogue: key, line: lineIndex });
        all.add(item.key);
        return item.key;
      });

    return { kind: "you" as const, instruction: line.you, answers: line.answers, itemKeys };
  });

  return {
    key,
    unitIndex,
    title: dialogue.title,
    setting: dialogue.setting,
    with: dialogue.with,
    lines,
    itemKeys: [...all],
  };
}
