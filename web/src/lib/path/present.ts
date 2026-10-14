import "server-only";

/**
 * Turn a planned step into what the browser shows: teaching cards, prompts
 * and multiple-choice options — never the answers, which /api/steps/answer
 * reveals one at a time after grading.
 */

import { getLesson, getPhrase, publicPracticeItem } from "@/lib/curriculum";
import { normalizeAnswer, normalizeKeepingAccents } from "@/lib/engine/grade";
import { unitCode, type Plan } from "./planner";
import { blankOut, gradeReply, tilesOf } from "./sentences";
import type {
  Course,
  CourseDialogue,
  GrammarItem,
  MeetEntry,
  PhraseItem,
  PlannedExercise,
  PublicDialogueLine,
  PublicExercise,
  PublicStep,
  Sentence,
  WordItem,
} from "./types";

const OPTION_COUNT = 4;
/** Replies to choose from in a role-play turn that is picked, not typed. */
const REPLY_OPTIONS = 3;

type Vocab = WordItem | PhraseItem;

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Wrong options for a multiple-choice card: same kind of item, from the same
 * lesson, category or situation first, then the same unit, then anything
 * already within reach. A candidate that shares any meaning with the card is
 * never used — two right answers would make the card unanswerable.
 */
function distractors(course: Course, item: Vocab, side: "english" | "target", random: () => number): string[] {
  const meanings = new Set(item.meanings.map(normalizeAnswer));
  const seen = new Set([normalizeAnswer(item[side])]);

  const pool = [...course.items.values()].filter(
    (other): other is Vocab =>
      other.kind === item.kind &&
      other.key !== item.key &&
      !other.meanings.some((meaning) => meanings.has(normalizeAnswer(meaning))),
  );
  const tiers = [
    pool.filter((other) => other.group === item.group),
    pool.filter((other) => other.group !== item.group && other.unitIndex === item.unitIndex),
    pool.filter((other) => other.unitIndex !== item.unitIndex && other.unitIndex <= item.unitIndex + 1),
    pool.filter((other) => other.unitIndex > item.unitIndex + 1),
  ];

  const picked: string[] = [];
  for (const tier of tiers) {
    for (const other of shuffle(tier, random)) {
      if (picked.length >= OPTION_COUNT - 1) return picked;
      const option = other[side];
      const key = normalizeAnswer(option);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(option);
    }
  }
  return picked;
}

/**
 * Wrong tiles for building a sentence: words from other sentences of the same
 * lesson or situation (the same grammar, so plausible), then the same unit.
 * Two for a short sentence, three for a longer one.
 */
function extraTiles(course: Course, sentence: Sentence, random: () => number): string[] {
  const own = new Set(tilesOf(sentence.target).map((tile) => normalizeKeepingAccents(tile)));
  const wanted = own.size <= 3 ? 2 : 3;
  const others = [...course.sentences.values()].filter((other) => other.id !== sentence.id);
  const tiers = [
    others.filter((other) => other.group === sentence.group),
    others.filter((other) => other.group !== sentence.group && other.unitIndex === sentence.unitIndex),
    others.filter((other) => other.unitIndex < sentence.unitIndex),
  ];

  const picked: string[] = [];
  for (const tier of tiers) {
    const words = shuffle(tier.flatMap((other) => tilesOf(other.target)), random);
    for (const word of words) {
      if (picked.length >= wanted) return picked;
      const key = normalizeKeepingAccents(word);
      if (own.has(key)) continue;
      own.add(key);
      picked.push(word);
    }
  }
  return picked;
}

/** The example to show on a reminder: a sentence that uses the item, translated if possible. */
function exampleFor(course: Course, ids: string[]): { target: string; english: string | null } | null {
  const sentences = ids.map((id) => course.sentences.get(id)).filter((sentence): sentence is Sentence => Boolean(sentence));
  const best = sentences.find((sentence) => sentence.english) ?? sentences[0];
  return best ? { target: best.target, english: best.english } : null;
}

/**
 * Replies to choose from in a role-play turn: the model answer and model
 * answers of turns from other role-plays — never one this turn would accept,
 * like another name where any name will do.
 */
function replyOptions(
  course: Course,
  dialogue: CourseDialogue,
  answers: string[],
  random: () => number,
): string[] {
  const accepted = new Set(answers.map(normalizeAnswer));
  const seen = new Set(accepted);
  const pool = shuffle(
    [...course.dialogues.values()]
      .filter((other) => other.key !== dialogue.key && Math.abs(other.unitIndex - dialogue.unitIndex) <= 2)
      .flatMap((other) => other.lines.flatMap((line) => (line.kind === "you" ? [line.answers[0]] : []))),
    random,
  );

  const options = [answers[0]];
  for (const reply of pool) {
    if (options.length >= REPLY_OPTIONS) break;
    const key = normalizeAnswer(reply);
    if (seen.has(key)) continue;
    seen.add(key);
    if (gradeReply(reply, answers).verdict !== "incorrect") continue;
    options.push(reply);
  }
  return shuffle(options, random);
}

/** A short reminder for an idea the learner keeps missing: its tip, or its first paragraph. */
function reminderFor(item: GrammarItem): string | null {
  const section = getLesson(item.lessonId)?.sections[item.section - 1];
  if (!section) return null;
  if (section.tip) return section.tip;
  // The first paragraph, markup kept for the page to render.
  const first = section.body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .find((paragraph) => paragraph && !paragraph.startsWith("- "));
  return first ? first.replace(/\s*\n\s*/g, " ") : null;
}

function present(
  course: Course,
  exercise: PlannedExercise,
  id: string,
  random: () => number,
): PublicExercise | null {
  if (exercise.mode === "dialogue") {
    const dialogue = course.dialogues.get(exercise.keys[0]);
    if (!dialogue) return null;
    let turn = 0;
    const lines = dialogue.lines.map((line, index): PublicDialogueLine => {
      if (line.kind === "them") return line;
      const typed = exercise.typed?.[turn++] ?? false;
      return {
        kind: "you",
        line: index,
        instruction: line.instruction,
        options: typed ? null : replyOptions(course, dialogue, line.answers, random),
      };
    });
    return {
      id,
      mode: "dialogue",
      itemKey: dialogue.key,
      kind: "dialogue",
      title: dialogue.title,
      setting: dialogue.setting,
      with: dialogue.with,
      lines,
    };
  }

  const item = course.items.get(exercise.keys[0]);
  if (!item) return null;

  if (exercise.mode === "meet") {
    const entries: MeetEntry[] = exercise.keys
      .map((key) => course.items.get(key))
      .filter((entry): entry is Vocab => entry?.kind === "word" || entry?.kind === "phrase")
      .map((entry) => {
        const phrase = entry.kind === "phrase" ? getPhrase(entry.phraseId) : null;
        return {
          key: entry.key,
          kind: entry.kind,
          target: entry.target,
          english: entry.english,
          note: phrase?.note ?? null,
          literally: phrase?.literally ?? null,
        };
      });
    if (entries.length === 0) return null;
    return { id, mode: "meet", itemKey: entries[0].key, kind: entries[0].kind, entries };
  }

  if (exercise.mode === "remind") {
    if (item.kind === "grammar") {
      const lesson = getLesson(item.lessonId);
      const example = lesson?.sections[item.section - 1]?.examples?.[0];
      return {
        id,
        mode: "remind",
        itemKey: item.key,
        kind: "grammar",
        title: item.heading,
        text: reminderFor(item) ?? "",
        example: example ? { target: example[0], english: example[1] } : null,
      };
    }
    const phrase = item.kind === "phrase" ? getPhrase(item.phraseId) : null;
    return {
      id,
      mode: "remind",
      itemKey: item.key,
      kind: item.kind,
      title: item.target,
      text: [item.english, phrase?.literally ? `literally “${phrase.literally}”` : null].filter(Boolean).join(" — "),
      example: exampleFor(course, item.kind === "word" ? item.clozes : []),
    };
  }

  if (exercise.mode === "build") {
    const sentence = exercise.sentence ? course.sentences.get(exercise.sentence) : undefined;
    if (!sentence?.english) return null;
    return {
      id,
      mode: "build",
      itemKey: item.key,
      kind: item.kind,
      sentence: sentence.id,
      prompt: sentence.english,
      tiles: shuffle([...tilesOf(sentence.target), ...extraTiles(course, sentence, random)], random),
    };
  }

  if (item.kind === "grammar") {
    const lesson = getLesson(item.lessonId);
    if (!lesson) return null;

    if (exercise.mode === "learn") {
      return {
        id,
        mode: "learn",
        itemKey: item.key,
        kind: "grammar",
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sectionNumber: item.section,
        sectionCount: lesson.sections.length,
        section: lesson.sections[item.section - 1],
      };
    }

    const question = exercise.question ?? -1;
    const practice = lesson.practice[question];
    if (exercise.mode !== "question" || !practice) return null;
    return {
      id,
      mode: "question",
      itemKey: item.key,
      kind: "grammar",
      lessonId: lesson.id,
      question: publicPracticeItem(practice, question),
    };
  }

  switch (exercise.mode) {
    case "recognize":
      return {
        id,
        mode: "recognize",
        itemKey: item.key,
        kind: item.kind,
        prompt: item.target,
        options: shuffle([item.english, ...distractors(course, item, "english", random)], random),
        isNew: exercise.role === "new",
      };
    case "recall":
      return {
        id,
        mode: "recall",
        itemKey: item.key,
        kind: item.kind,
        prompt: item.english,
        options: shuffle([item.target, ...distractors(course, item, "target", random)], random),
      };
    case "type":
      return { id, mode: "type", itemKey: item.key, kind: item.kind, prompt: item.english };
    case "cloze": {
      const sentence = exercise.sentence ? course.sentences.get(exercise.sentence) : undefined;
      const blank = sentence ? blankOut(sentence.target, item.accepted) : null;
      if (!sentence || !blank) return null;
      return {
        id,
        mode: "cloze",
        itemKey: item.key,
        kind: item.kind,
        sentence: sentence.id,
        before: blank.before,
        after: blank.after,
        translation: sentence.english,
        hint: sentence.english ? null : item.english,
      };
    }
    case "reply": {
      const dialogue = exercise.reply ? course.dialogues.get(exercise.reply.dialogue) : undefined;
      const line = dialogue?.lines[exercise.reply!.line];
      if (!dialogue || line?.kind !== "you") return null;
      const before = dialogue.lines.slice(0, exercise.reply!.line).reverse().find((other) => other.kind === "them");
      return {
        id,
        mode: "reply",
        itemKey: item.key,
        kind: item.kind,
        dialogue: dialogue.key,
        line: exercise.reply!.line,
        with: dialogue.with,
        context: before?.kind === "them" ? { target: before.target, english: before.english } : null,
        instruction: line.instruction,
      };
    }
    default:
      return null;
  }
}

export function presentStep(course: Course, plan: Plan, random: () => number): PublicStep {
  const unit = course.units[plan.unitIndex];
  return {
    exercises: plan.exercises
      .map((exercise, index) => present(course, exercise, String(index), random))
      .filter((exercise): exercise is PublicExercise => exercise !== null),
    unit: { id: unit.id, code: unitCode(unit), title: unit.title, level: unit.level },
    challenge: plan.exercises.some((exercise) => exercise.role === "challenge"),
  };
}
