/**
 * Shapes for the guided path (docs/guided-path.md).
 *
 * Kept free of "server-only" and of the content catalogs: the pure scheduling
 * and planning code, its tests, and the browser all import from here.
 */

import type { LessonSection, PublicPracticeItem } from "@/lib/curriculum/types";

export type ItemKind = "word" | "phrase" | "grammar";

interface ItemBase {
  /** Stable across releases: "w:italian:stanco", "p:italian-a1-cafe-3", "g:italian-a1-03-essere#2". */
  key: string;
  /** Index into Course.units. */
  unitIndex: number;
}

export interface WordItem extends ItemBase {
  kind: "word";
  /** As displayed: "stanco", "il / la". */
  target: string;
  /** Typed answers accepted for it. */
  accepted: string[];
  /** The English shown on cards. */
  english: string;
  /** Every English meaning, so a multiple-choice distractor never shares one. */
  meanings: string[];
  /** Words in the same group make the best distractors: a lesson or a vocabulary category. */
  group: string;
}

export interface PhraseItem extends ItemBase {
  kind: "phrase";
  phraseId: string;
  target: string;
  accepted: string[];
  english: string;
  meanings: string[];
  /** The phrasebook situation. */
  group: string;
}

export interface GrammarItem extends ItemBase {
  kind: "grammar";
  lessonId: string;
  /** 1-based section number. */
  section: number;
  heading: string;
  /** The lesson's practice questions tagged with this section. */
  questions: { index: number; type: "fill" | "translate" | "choice" }[];
}

export type Item = WordItem | PhraseItem | GrammarItem;

/** One piece of new material, taught in the order the course lists them. */
export type IntroEntry =
  | { type: "grammar"; key: string }
  | { type: "words"; keys: string[] }
  | { type: "phrases"; keys: string[] };

export interface CourseUnit {
  id: string;
  level: string;
  number: number;
  title: string;
  lessonIds: string[];
  itemKeys: string[];
  intro: IntroEntry[];
}

/** Everything one language's guided path can teach, in order. */
export interface Course {
  language: string;
  units: CourseUnit[];
  items: Map<string, Item>;
}

/** What the learner knows about one item; mirrors the ItemProgress row. */
export interface ItemState {
  stage: number;
  bestStage: number;
  dueAt: Date;
  intervalDays: number;
  right: number;
  wrong: number;
  rightStreak: number;
  missStreak: number;
  tricky: boolean;
}

/**
 * How an item is practised.
 *
 * - learn: a lesson section as a card
 * - meet: new words or phrases, shown with their meaning
 * - recognize: the target language → pick the English
 * - recall: English → pick the target language
 * - type: English → type the target language
 * - question: one of a lesson section's practice questions
 */
export type ExerciseMode = "learn" | "meet" | "recognize" | "recall" | "type" | "question";

export type ExerciseRole = "warmup" | "new" | "tricky" | "review" | "extra";

export interface PlannedExercise {
  mode: ExerciseMode;
  /** One item, or several for a meet card. */
  keys: string[];
  /** For a question: the practice item's index in its lesson. */
  question?: number;
  /** Show a short reminder first: the item has been missed twice in a row. */
  reminder?: boolean;
  role: ExerciseRole;
}

/* ---- What the browser receives: prompts and teaching, never answers. ---- */

interface PublicBase {
  id: string;
  itemKey: string;
  kind: ItemKind;
}

export interface MeetEntry {
  key: string;
  kind: "word" | "phrase";
  target: string;
  english: string;
  note: string | null;
  literally: string | null;
}

export type PublicExercise =
  | (PublicBase & {
      mode: "learn";
      lessonId: string;
      lessonTitle: string;
      sectionNumber: number;
      sectionCount: number;
      section: LessonSection;
    })
  | { id: string; mode: "meet"; itemKey: string; kind: "word" | "phrase"; entries: MeetEntry[] }
  | (PublicBase & { mode: "recognize"; prompt: string; options: string[]; isNew: boolean })
  | (PublicBase & { mode: "recall"; prompt: string; options: string[] })
  | (PublicBase & { mode: "type"; prompt: string })
  | (PublicBase & {
      mode: "question";
      lessonId: string;
      question: PublicPracticeItem;
      reminder: string | null;
    });

export interface StepUnit {
  id: string;
  /** "A1.3" */
  code: string;
  title: string;
  level: string;
}

export interface PublicStep {
  exercises: PublicExercise[];
  unit: StepUnit;
}

export interface StepAnswerResult {
  verdict: "correct" | "close" | "incorrect";
  points: number;
  note: string | null;
  /** The right answer(s), revealed after grading. */
  answers: string[];
  why: string | null;
  stage: number;
  /** True when this answer moved the item up a stage. */
  promoted: boolean;
}
