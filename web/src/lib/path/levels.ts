/**
 * A CEFR level's progress, for the level page: its units, a count each for
 * words, phrases, grammar and speaking, and whether the level is done.
 *
 * Pure, like the planner. The bars (level and units) are protected by unit
 * marks. Words, phrases, grammar and speaking are counts, not bars: a bar over
 * the level's current items would shrink whenever content is added (#91).
 */

import { unitProgress, type UnitMark, type UnitProgress } from "./planner";
import { LEARNED_STAGE } from "./schedule";
import type { Course, ItemKind, ItemState } from "./types";

export interface Count {
  /** Items learned (best stage 3+), or role-plays played. Never goes down while item keys stay put. */
  done: number;
  /** Items in the level the learner hasn't met yet, or role-plays not yet played. New content adds only here. */
  notMet: number;
}

export interface LevelProgress {
  level: string;
  units: UnitProgress[];
  percent: number;
  complete: boolean;
  words: Count;
  phrases: Count;
  grammar: Count;
  /** Role-plays played at least once. */
  speaking: Count;
}

/** Hours of practice a level takes, roughly — shown as a guide, never a gate. */
export const LEVEL_HOURS: Record<string, number> = { a1: 40, a2: 60, b1: 120, b2: 160, c1: 200, c2: 240 };

export function levelsOf(course: Course): string[] {
  return [...new Set(course.units.map((unit) => unit.level))];
}

function count(keys: string[], states: Map<string, ItemState>): Count {
  return {
    done: keys.filter((key) => (states.get(key)?.bestStage ?? 0) >= LEARNED_STAGE).length,
    notMet: keys.filter((key) => !states.has(key)).length,
  };
}

/** Partial credit for items on their way up, for a level without units. */
function climbedPercent(keys: string[], states: Map<string, ItemState>): number {
  const climbed = keys.reduce((sum, key) => sum + Math.min(LEARNED_STAGE, states.get(key)?.bestStage ?? 0), 0);
  return keys.length > 0 ? Math.floor((climbed / (keys.length * LEARNED_STAGE)) * 100) : 0;
}

export function levelProgress(
  course: Course,
  states: Map<string, ItemState>,
  level: string,
  marks: Map<string, UnitMark> = new Map(),
): LevelProgress {
  const units = unitProgress(course, states, marks).filter((unit) => unit.level === level);
  const indices = new Set(units.map((unit) => unit.index));
  const keys = course.units.filter((_, index) => indices.has(index)).flatMap((unit) => unit.itemKeys);
  const ofKind = (kind: ItemKind) => keys.filter((key) => course.items.get(key)?.kind === kind);

  const dialogues = [...course.dialogues.values()].filter((dialogue) => indices.has(dialogue.unitIndex));
  const played = dialogues.filter((dialogue) => (states.get(dialogue.key)?.right ?? 0) > 0).length;

  return {
    level,
    units,
    // Each unit weighs the same, as each is a week's work.
    percent:
      units.length > 0
        ? Math.floor(units.reduce((sum, unit) => sum + unit.percent, 0) / units.length)
        : climbedPercent(keys, states),
    complete: units.length > 0 && units.every((unit) => unit.complete),
    words: count(ofKind("word"), states),
    phrases: count(ofKind("phrase"), states),
    grammar: count(ofKind("grammar"), states),
    speaking: { done: played, notMet: dialogues.length - played },
  };
}

/** "1 word", "438 words". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "438 words learned · 20 not met yet", "1 word learned · nothing new", "no words learned yet · 3 not met yet". */
export function countLine(
  { done, notMet }: Count,
  one: string,
  many: string,
  verb: string,
  left: string,
  noneLeft: string,
): string {
  const doneText = done === 0 ? `no ${many} ${verb} yet` : `${plural(done, one, many)} ${verb}`;
  return `${doneText} · ${notMet === 0 ? noneLeft : `${notMet} ${left}`}`;
}

/** What a certificate prints. Stored on the level's achievement when it is awarded, so it never changes. */
export interface CertificateCounts {
  words: number;
  phrases: number;
  grammar: number;
  conversations: number;
}

export function levelCounts(progress: LevelProgress): CertificateCounts {
  return {
    words: progress.words.done,
    phrases: progress.phrases.done,
    grammar: progress.grammar.done,
    conversations: progress.speaking.done,
  };
}

/** The counts stored with the certificate; the live ones only for a certificate stored before there were any. */
export function certificateCounts(stored: unknown, live: LevelProgress): CertificateCounts {
  const fields = ["words", "phrases", "grammar", "conversations"] as const;
  if (stored && typeof stored === "object" && fields.every((field) => typeof (stored as Record<string, unknown>)[field] === "number")) {
    const counts = stored as Record<(typeof fields)[number], number>;
    return { words: counts.words, phrases: counts.phrases, grammar: counts.grammar, conversations: counts.conversations };
  }
  return levelCounts(live);
}

/** Levels with every unit complete. */
export function completedLevels(
  course: Course,
  states: Map<string, ItemState>,
  marks: Map<string, UnitMark> = new Map(),
): string[] {
  return levelsOf(course).filter((level) => levelProgress(course, states, level, marks).complete);
}

/** The achievement name a finished level is stored under. */
export function levelAchievement(language: string, level: string): string {
  return `level:${language}:${level}`;
}

/**
 * Days until the level is done at the learner's pace: how much of it each
 * hour of practice has covered so far, and how many minutes a day they have
 * been practising lately. Null until there is enough to go on.
 */
export function daysToFinish(percent: number, practisedHours: number, minutesPerDay: number): number | null {
  if (percent <= 0 || percent >= 100 || practisedHours < 0.5 || minutesPerDay <= 0) return null;
  const hoursLeft = (practisedHours / percent) * (100 - percent);
  return Math.ceil((hoursLeft * 60) / minutesPerDay);
}
