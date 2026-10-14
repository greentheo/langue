/**
 * A CEFR level's progress, for the level page: its units, one bar each for
 * words, phrases, grammar and speaking, and whether the level is done.
 *
 * Pure, like the planner. Every bar counts best stages (or role-plays ever
 * played), so none of them ever goes down.
 */

import { unitProgress, type UnitProgress } from "./planner";
import { LEARNED_STAGE } from "./schedule";
import type { Course, ItemKind, ItemState } from "./types";

export interface Bar {
  /** Items learned (best stage 3+), or role-plays played. */
  done: number;
  total: number;
  /** 0–100, with partial credit for items on their way up. */
  percent: number;
}

export interface LevelProgress {
  level: string;
  units: UnitProgress[];
  percent: number;
  complete: boolean;
  words: Bar;
  phrases: Bar;
  grammar: Bar;
  /** Role-plays played at least once. */
  speaking: Bar;
}

/** Hours of practice a level takes, roughly — shown as a guide, never a gate. */
export const LEVEL_HOURS: Record<string, number> = { a1: 40, a2: 60, b1: 120, b2: 160, c1: 200, c2: 240 };

export function levelsOf(course: Course): string[] {
  return [...new Set(course.units.map((unit) => unit.level))];
}

function bar(keys: string[], states: Map<string, ItemState>): Bar {
  const climbed = keys.reduce((sum, key) => sum + Math.min(LEARNED_STAGE, states.get(key)?.bestStage ?? 0), 0);
  return {
    done: keys.filter((key) => (states.get(key)?.bestStage ?? 0) >= LEARNED_STAGE).length,
    total: keys.length,
    percent: keys.length > 0 ? Math.floor((climbed / (keys.length * LEARNED_STAGE)) * 100) : 0,
  };
}

export function levelProgress(course: Course, states: Map<string, ItemState>, level: string): LevelProgress {
  const units = unitProgress(course, states).filter((unit) => unit.level === level);
  const indices = new Set(units.map((unit) => unit.index));
  const keys = course.units.filter((_, index) => indices.has(index)).flatMap((unit) => unit.itemKeys);
  const ofKind = (kind: ItemKind) => keys.filter((key) => course.items.get(key)?.kind === kind);

  const dialogues = [...course.dialogues.values()].filter((dialogue) => indices.has(dialogue.unitIndex));
  const played = dialogues.filter((dialogue) => (states.get(dialogue.key)?.right ?? 0) > 0).length;

  const all = bar(keys, states);
  return {
    level,
    units,
    // Each unit weighs the same, as each is a week's work.
    percent: units.length > 0 ? Math.floor(units.reduce((sum, unit) => sum + unit.percent, 0) / units.length) : all.percent,
    complete: units.length > 0 && units.every((unit) => unit.complete),
    words: bar(ofKind("word"), states),
    phrases: bar(ofKind("phrase"), states),
    grammar: bar(ofKind("grammar"), states),
    speaking: {
      done: played,
      total: dialogues.length,
      percent: dialogues.length > 0 ? Math.floor((played / dialogues.length) * 100) : 0,
    },
  };
}

/** Levels with every unit complete. */
export function completedLevels(course: Course, states: Map<string, ItemState>): string[] {
  return levelsOf(course).filter((level) => levelProgress(course, states, level).complete);
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
