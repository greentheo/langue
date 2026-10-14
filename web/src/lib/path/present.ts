import "server-only";

/**
 * Turn a planned step into what the browser shows: teaching cards, prompts
 * and multiple-choice options — never the answers, which /api/steps/answer
 * reveals one at a time after grading.
 */

import { getLesson, getPhrase, publicPracticeItem } from "@/lib/curriculum";
import { normalizeAnswer } from "@/lib/engine/grade";
import { unitCode, type Plan } from "./planner";
import type {
  Course,
  GrammarItem,
  MeetEntry,
  PhraseItem,
  PlannedExercise,
  PublicExercise,
  PublicStep,
  WordItem,
} from "./types";

const OPTION_COUNT = 4;

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
      reminder: exercise.reminder ? reminderFor(item) : null,
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
  };
}
