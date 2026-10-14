/**
 * Compiled curriculum shapes, as emitted into generated.ts.
 *
 * The YAML files are authored for people; these are shaped for the app — ids
 * resolved, lessons numbered, grammar topics linked to lesson ids.
 */

import type { DialogueLine, LessonSection, PracticeItem } from "./schema";

export type { DialogueLine, LessonSection, PracticeItem };

export interface Lesson {
  /** Globally unique and URL-safe: "italian-a1-04-articles". */
  id: string;
  /** File name without extension: "04-articles". */
  slug: string;
  number: number;
  language: string;
  level: string;
  title: string;
  subtitle: string | null;
  goal: string;
  minutes: number;
  sections: LessonSection[];
  /** `[target, english]` pairs introduced by the lesson. */
  words: [string, string][];
  practice: PracticeItem[];
}

export interface GrammarTopic {
  topic: string;
  /** Lesson ids that teach this topic; empty when no lesson exists yet. */
  lessonIds: string[];
}

export interface LevelOverview {
  language: string;
  level: string;
  title: string;
  summary: string;
  canDo: string[];
  grammar: GrammarTopic[];
  themes: string[];
}

export interface Phrase {
  /** "italian-a1-cafe-3" — stable while the phrasebook order is. */
  id: string;
  language: string;
  level: string;
  situationId: string;
  target: string[];
  english: string[];
  display: string;
  note: string | null;
  literally: string | null;
}

export interface Situation {
  id: string;
  title: string;
  phrases: Phrase[];
}

/** One sub-level of a CEFR level: A1.1, A1.2, … */
export interface Unit {
  /** "italian-a1-3". */
  id: string;
  language: string;
  level: string;
  /** 1-based: unit 3 of A1 is shown as A1.3. */
  number: number;
  title: string;
  lessonIds: string[];
  situationIds: string[];
  /** Vocabulary-library categories whose words this unit teaches. */
  categories: string[];
}

/** A scripted role-play (data/curriculum/<language>/<level>/dialogues.yaml). */
export interface Dialogue {
  /** "italian-a1-cafe-order". */
  id: string;
  language: string;
  level: string;
  /** The unit's number within the level: 9 is A1.9. */
  unit: number;
  title: string;
  setting: string;
  with: string;
  lines: DialogueLine[];
}

export interface LevelCurriculum {
  overview: LevelOverview | null;
  lessons: Lesson[];
  situations: Situation[];
  /** Empty while a level has no guided path yet. */
  units: Unit[];
  dialogues: Dialogue[];
}

export type CurriculumCatalog = Record<string, Partial<Record<string, LevelCurriculum>>>;

/** A practice item as the browser sees it: everything except the answers. */
export interface PublicPracticeItem {
  index: number;
  type: PracticeItem["type"];
  prompt: string;
  hint: string | null;
  translation: string | null;
  direction: "to-target" | "to-english" | null;
  options: string[] | null;
}
