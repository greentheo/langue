/**
 * Shapes for the guided path (docs/guided-path.md).
 *
 * Kept free of "server-only" and of the content catalogs: the pure scheduling
 * and planning code, its tests, and the browser all import from here.
 */

import type { LessonSection, PublicPracticeItem } from "@/lib/curriculum/types";

export type ItemKind = "word" | "phrase" | "grammar";

/**
 * The exercises that move a word or phrase up its stage ladder, in order:
 * the exercise at index n proves stage n + 1. Which rungs an item has depends
 * on the content: a cloze needs a sentence that uses the word, a reply needs a
 * role-play turn that says it, building from tiles needs a phrase of several
 * words.
 */
export type LadderMode = "recognize" | "recall" | "build" | "type" | "cloze" | "reply";

/** A role-play turn that uses an item: the dialogue's key and the line's index. */
export interface ReplyRef {
  dialogue: string;
  line: number;
}

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
  ladder: LadderMode[];
  /** Sentences the word can be blanked out of. */
  clozes: string[];
  replies: ReplyRef[];
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
  ladder: LadderMode[];
  /** The phrase as a sentence to build from tiles, when it has several words. */
  build: string | null;
  replies: ReplyRef[];
}

export interface GrammarItem extends ItemBase {
  kind: "grammar";
  lessonId: string;
  /** 1-based section number. */
  section: number;
  heading: string;
  /** The lesson's practice questions tagged with this section. */
  questions: { index: number; type: "fill" | "translate" | "choice" }[];
  /** The section's examples that can be built from tiles. */
  builds: string[];
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

/** A sentence from the course: a lesson example, a phrase, a vocabulary example. */
export interface Sentence {
  /** "s:italian-a1-03-essere#2.1", "s:p:italian-a1-cafe-3", "s:w:italian:stanco#1". */
  id: string;
  target: string;
  /** Null for vocabulary examples nobody has translated yet. */
  english: string | null;
  /** Its lesson, situation or category: other sentences there make good wrong tiles. */
  group: string;
  unitIndex: number;
}

export type CourseDialogueLine =
  | { kind: "them"; target: string; english: string }
  | {
      kind: "you";
      instruction: string;
      /** The first is the model answer. */
      answers: string[];
      /** Words and phrases the model answer uses. */
      itemKeys: string[];
    };

/** A scripted role-play on the path. */
export interface CourseDialogue {
  /** "d:italian-a1-cafe-order". Also its ItemProgress key. */
  key: string;
  unitIndex: number;
  title: string;
  setting: string;
  with: string;
  lines: CourseDialogueLine[];
  /** Every item its turns use. */
  itemKeys: string[];
}

/** Everything one language's guided path can teach, in order. */
export interface Course {
  language: string;
  units: CourseUnit[];
  items: Map<string, Item>;
  sentences: Map<string, Sentence>;
  dialogues: Map<string, CourseDialogue>;
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
 * - remind: a quick look again at something the learner keeps missing
 * - recognize: the target language → pick the English
 * - recall: English → pick the target language
 * - build: English → put word tiles in order
 * - type: English → type the target language
 * - cloze: a sentence with the word blanked out → type it
 * - reply: one turn of a role-play → type the reply
 * - question: one of a lesson section's practice questions
 * - dialogue: a whole role-play, turn by turn
 */
export type ExerciseMode = "learn" | "meet" | "remind" | LadderMode | "question" | "dialogue";

export type ExerciseRole = "warmup" | "new" | "tricky" | "review" | "extra" | "stretch" | "challenge";

export interface PlannedExercise {
  mode: ExerciseMode;
  /** One item, or several for a meet card. A dialogue's own key for a role-play. */
  keys: string[];
  /** For a question: the practice item's index in its lesson. */
  question?: number;
  /** For build and cloze: the sentence. */
  sentence?: string;
  /** For reply: the role-play turn. */
  reply?: ReplyRef;
  /** For a role-play: whether each of the learner's turns is typed (or picked). */
  typed?: boolean[];
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

/** A role-play line as the browser sees it: the learner's replies stay on the server. */
export type PublicDialogueLine =
  | { kind: "them"; target: string; english: string }
  | { kind: "you"; line: number; instruction: string; options: string[] | null };

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
  | (PublicBase & {
      mode: "remind";
      /** The word or phrase, or the idea's heading. */
      title: string;
      /** Its meaning, or the idea's tip. */
      text: string;
      example: { target: string; english: string | null } | null;
    })
  | (PublicBase & { mode: "build"; sentence: string; prompt: string; tiles: string[] })
  | (PublicBase & {
      mode: "cloze";
      sentence: string;
      before: string;
      after: string;
      translation: string | null;
      /** The word's meaning, when the sentence has no translation. */
      hint: string | null;
    })
  | (PublicBase & {
      mode: "reply";
      dialogue: string;
      line: number;
      with: string;
      /** What the other person just said. */
      context: { target: string; english: string } | null;
      instruction: string;
    })
  | {
      id: string;
      mode: "dialogue";
      itemKey: string;
      kind: "dialogue";
      title: string;
      setting: string;
      with: string;
      lines: PublicDialogueLine[];
    }
  | (PublicBase & { mode: "recognize"; prompt: string; options: string[]; isNew: boolean })
  | (PublicBase & { mode: "recall"; prompt: string; options: string[] })
  | (PublicBase & { mode: "type"; prompt: string })
  | (PublicBase & {
      mode: "question";
      lessonId: string;
      question: PublicPracticeItem;
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
  /** A level-up challenge for `unit`, rather than an ordinary step. */
  challenge: boolean;
}

export interface StepAnswerResult {
  verdict: "correct" | "close" | "incorrect";
  points: number;
  note: string | null;
  /** A near miss rejected for its ending: counted per step (ActivityLog.metadata.endingMisses). */
  endingMiss?: "otherForm" | "misspelt";
  /** Right but for its accents: another form, a different word, or a plain slip. Counted per step (ActivityLog.metadata.accentMisses). */
  accentMiss?: "otherForm" | "otherWord" | "plain";
  /** The right answer(s), revealed after grading. */
  answers: string[];
  why: string | null;
  stage: number;
  /** True when this answer moved the item up a stage. */
  promoted: boolean;
}
