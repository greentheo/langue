/**
 * The stage ladder and review schedule (docs/guided-path.md).
 *
 * Pure: the answer route reads a row, applies one answer here, and writes the
 * row back. Every rule about moving up, moving down and coming due lives in
 * this file and its tests.
 */

import type { ExerciseMode, ItemKind, ItemState } from "./types";

export const MAX_STAGE = 5;

/** Best stage at which an item counts as learned: the learner can produce it. */
export const LEARNED_STAGE = 3;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** How long after reaching a stage the item comes due again. */
const INTERVAL_MS: Record<number, number> = {
  0: 0,
  1: 10 * MINUTE_MS,
  2: 1 * DAY_MS,
  3: 3 * DAY_MS,
  4: 7 * DAY_MS,
  5: 21 * DAY_MS,
};

/** Once an item is at the top, each review doubles the wait, up to this. */
const MAX_INTERVAL_DAYS = 120;

/** A missed item comes back this soon — after the current step, not during it. */
const RETRY_MS = 10 * MINUTE_MS;

/** Misses in a row that make an item tricky; rights in a row that clear it. */
const TRICKY_AFTER = 2;
const CLEAR_AFTER = 2;

export function newItemState(now: Date): ItemState {
  return {
    stage: 0,
    bestStage: 0,
    dueAt: now,
    intervalDays: 0,
    right: 0,
    wrong: 0,
    rightStreak: 0,
    missStreak: 0,
    tricky: false,
  };
}

export function isDue(state: ItemState, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}

export function isLearned(state: ItemState | undefined): boolean {
  return (state?.bestStage ?? 0) >= LEARNED_STAGE;
}

/**
 * The highest stage an exercise can prove. Picking the meaning proves
 * recognition and nothing more; typing it proves everything this phase can
 * test. A lesson question can carry a grammar idea all the way up.
 */
export function rungOf(mode: ExerciseMode, kind: ItemKind): number {
  if (kind === "grammar") return mode === "question" ? MAX_STAGE : 0;
  switch (mode) {
    case "recognize":
      return 1;
    case "recall":
      return 2;
    case "type":
      return MAX_STAGE;
    default:
      return 0;
  }
}

/** How a word or phrase at this stage is normally practised. */
export function modeForStage(stage: number): "recognize" | "recall" | "type" {
  if (stage <= 0) return "recognize";
  if (stage === 1) return "recall";
  return "type";
}

/** One rung easier, for an item the learner keeps missing. */
export function easierMode(stage: number): "recognize" | "recall" | "type" {
  return modeForStage(Math.max(0, stage - 1));
}

/**
 * Apply one answer.
 *
 * Right while due, with an exercise hard enough to prove the next stage: up
 * one stage, and the next review moves further away. Right otherwise: it
 * counts as practice and the schedule stays. Wrong: down one stage, back in
 * ten minutes. A close answer (a typo, a missing accent) counts as right.
 */
export function applyAnswer(
  state: ItemState,
  answer: { correct: boolean; rung: number },
  now: Date,
): ItemState {
  if (!answer.correct) {
    const missStreak = state.missStreak + 1;
    return {
      ...state,
      stage: Math.max(0, state.stage - 1),
      dueAt: new Date(now.getTime() + RETRY_MS),
      wrong: state.wrong + 1,
      rightStreak: 0,
      missStreak,
      tricky: state.tricky || missStreak >= TRICKY_AFTER,
    };
  }

  const rightStreak = state.rightStreak + 1;
  const next: ItemState = {
    ...state,
    right: state.right + 1,
    rightStreak,
    missStreak: 0,
    tricky: state.tricky && rightStreak < CLEAR_AFTER,
  };

  const target = Math.min(MAX_STAGE, state.stage + 1);
  if (!isDue(state, now) || answer.rung < target) return next;

  if (state.stage === MAX_STAGE) {
    // At the top: no higher stage, just a longer wait each time.
    const intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.max(21, state.intervalDays * 2));
    return { ...next, intervalDays, dueAt: new Date(now.getTime() + intervalDays * DAY_MS) };
  }

  return {
    ...next,
    stage: target,
    bestStage: Math.max(state.bestStage, target),
    intervalDays: target === MAX_STAGE ? 21 : 0,
    dueAt: new Date(now.getTime() + INTERVAL_MS[target]),
  };
}
