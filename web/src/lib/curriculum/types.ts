/**
 * Compiled curriculum shapes, as emitted into generated.ts.
 *
 * The YAML files are authored for people; these are shaped for the app — ids
 * resolved, lessons numbered, grammar topics linked to lesson ids.
 */

import type { LessonSection, PracticeItem } from "./schema";

export type { LessonSection, PracticeItem };

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

export interface LevelCurriculum {
  overview: LevelOverview | null;
  lessons: Lesson[];
  situations: Situation[];
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
