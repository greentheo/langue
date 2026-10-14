/**
 * The step planner (docs/guided-path.md).
 *
 * Builds one ~3-minute step from the course and what the learner knows:
 * a couple of easy wins, some new material if they are keeping up, the items
 * they keep missing, then reviews that are due. Pure — the route loads the
 * learner's item states and passes them in, so every rule is unit-tested.
 */

import { easierMode, isDue, isLearned, LEARNED_STAGE, modeForStage } from "./schedule";
import type {
  Course,
  CourseUnit,
  GrammarItem,
  IntroEntry,
  Item,
  ItemState,
  PlannedExercise,
} from "./types";

/** Seconds a step aims for. */
export const STEP_SECONDS = 180;
/** Seconds of new material when there are reviews waiting. */
const NEW_SECONDS = 80;
const MAX_EXERCISES = 14;
/** Most learn cards in one step; more than two ideas at once is a lesson, not a step. */
const MAX_NEW_IDEAS = 2;
/** Most new words and phrases in one step. */
const MAX_NEW_VOCAB = 6;
/** New material pauses while more than this many reviews are due… */
const MAX_BACKLOG = 20;
/** …or while recent steps went worse than this. */
const MIN_ACCURACY = 0.7;

/** Rough seconds per exercise, for filling the budget. */
const SECONDS = {
  learn: 30,
  meetEach: 6,
  recognize: 7,
  recall: 8,
  type: 14,
  choice: 9,
  fill: 13,
  translate: 20,
} as const;

export function unitCode(unit: CourseUnit): string {
  return `${unit.level.toUpperCase()}.${unit.number}`;
}

export function unitComplete(unit: CourseUnit, states: Map<string, ItemState>): boolean {
  return unit.itemKeys.every((key) => isLearned(states.get(key)));
}

/** The first unit with anything left to learn; units.length when all are done. */
export function firstOpenUnit(course: Course, states: Map<string, ItemState>): number {
  const index = course.units.findIndex((unit) => !unitComplete(unit, states));
  return index === -1 ? course.units.length : index;
}

/**
 * The next piece of new material, trimmed to what is not yet introduced.
 * New material may run one unit ahead of the oldest unfinished one, so a
 * learner is never stuck waiting for reviews to come due, but cannot race
 * ahead and leave a trail of half-learned units.
 */
export function nextIntro(
  course: Course,
  states: Map<string, ItemState>,
  planned: Set<string> = new Set(),
): { entry: IntroEntry; unitIndex: number } | null {
  const fresh = (key: string) => !states.has(key) && !planned.has(key);
  const lastUnit = Math.min(course.units.length - 1, firstOpenUnit(course, states) + 1);

  for (let unitIndex = 0; unitIndex <= lastUnit; unitIndex++) {
    for (const entry of course.units[unitIndex].intro) {
      if (entry.type === "grammar") {
        if (fresh(entry.key)) return { entry, unitIndex };
        continue;
      }
      const keys = entry.keys.filter(fresh);
      if (keys.length > 0) return { entry: { ...entry, keys }, unitIndex };
    }
  }
  return null;
}

/**
 * Which of a grammar idea's questions to ask. Early on, multiple choice and
 * fill-in-the-blank; once the idea is familiar, translation first. Rotates
 * through questions of the preferred type so the same one does not repeat.
 */
export function questionFor(
  item: GrammarItem,
  state: ItemState | undefined,
  skip: Set<number> = new Set(),
): number | null {
  const stage = state?.stage ?? 0;
  const preference =
    stage <= 0
      ? ["choice", "fill", "translate"]
      : stage === 1
        ? ["fill", "choice", "translate"]
        : ["translate", "fill", "choice"];

  const available = item.questions.filter((question) => !skip.has(question.index));
  for (const type of preference) {
    const candidates = available.filter((question) => question.type === type);
    if (candidates.length > 0) {
      const attempts = (state?.right ?? 0) + (state?.wrong ?? 0);
      return candidates[attempts % candidates.length].index;
    }
  }
  return null;
}

function reviewExercise(
  item: Item,
  state: ItemState,
  role: PlannedExercise["role"],
): PlannedExercise | null {
  if (item.kind === "grammar") {
    const question = questionFor(item, state);
    if (question === null) return null;
    return { mode: "question", keys: [item.key], question, reminder: state.tricky, role };
  }
  const mode = state.tricky ? easierMode(state.stage) : modeForStage(state.stage);
  return { mode, keys: [item.key], role };
}

function cost(exercise: PlannedExercise, course: Course): number {
  switch (exercise.mode) {
    case "learn":
      return SECONDS.learn;
    case "meet":
      return SECONDS.meetEach * exercise.keys.length;
    case "question": {
      const item = course.items.get(exercise.keys[0]);
      const type =
        item?.kind === "grammar"
          ? item.questions.find((question) => question.index === exercise.question)?.type
          : undefined;
      return SECONDS[type ?? "fill"];
    }
    default:
      return SECONDS[exercise.mode];
  }
}

/** The exercises that introduce one piece of new material. */
function introduce(entry: IntroEntry, course: Course): PlannedExercise[] {
  if (entry.type === "grammar") {
    const item = course.items.get(entry.key);
    if (item?.kind !== "grammar") return [];
    const first = questionFor(item, undefined);
    const second = first === null ? null : questionFor(item, undefined, new Set([first]));
    return [
      { mode: "learn", keys: [entry.key], role: "new" },
      ...[first, second]
        .filter((question): question is number => question !== null)
        .map((question): PlannedExercise => ({ mode: "question", keys: [entry.key], question, role: "new" })),
    ];
  }

  return [
    { mode: "meet", keys: entry.keys, role: "new" },
    ...entry.keys.map((key): PlannedExercise => ({ mode: "recognize", keys: [key], role: "new" })),
  ];
}

export interface PlanInput {
  course: Course;
  states: Map<string, ItemState>;
  now: Date;
  /** Share right over the last few steps; null before the first. */
  recentAccuracy: number | null;
  random: () => number;
}

export interface Plan {
  exercises: PlannedExercise[];
  /** The unit the step mostly belongs to: its new material, or the oldest unfinished. */
  unitIndex: number;
}

export function planStep({ course, states, now, recentAccuracy, random }: PlanInput): Plan {
  const used = new Set<string>();
  let spent = 0;
  let count = 0;

  const warmup: PlannedExercise[] = [];
  const fresh: PlannedExercise[] = [];
  const mixed: PlannedExercise[] = [];

  const add = (list: PlannedExercise[], exercise: PlannedExercise) => {
    list.push(exercise);
    for (const key of exercise.keys) used.add(key);
    spent += cost(exercise, course);
    if (exercise.mode !== "learn" && exercise.mode !== "meet") count += 1;
  };

  const known = [...states.entries()]
    .filter(([key]) => course.items.has(key))
    .map(([key, state]) => ({ item: course.items.get(key)!, state }));
  const byDue = (a: { state: ItemState }, b: { state: ItemState }) =>
    a.state.dueAt.getTime() - b.state.dueAt.getTime();
  const due = known.filter(({ state }) => isDue(state, now)).sort(byDue);

  // 1. Warm-up: things they know well, so the step starts with a win.
  for (const { item, state } of due
    .filter(({ state }) => state.stage >= 2 && !state.tricky)
    .sort((a, b) => b.state.stage - a.state.stage)
    .slice(0, 2)) {
    const exercise = reviewExercise(item, state, "warmup");
    if (exercise) add(warmup, exercise);
  }

  // 2. New material, if they are keeping up — or if there is little else to do.
  const tricky = known.filter(({ item, state }) => state.tricky && !used.has(item.key)).sort(byDue);
  const waiting = due.filter(({ item }) => !used.has(item.key)).length + tricky.length;
  const keepingUp =
    due.length <= MAX_BACKLOG && (recentAccuracy === null || recentAccuracy >= MIN_ACCURACY);

  let unitIndex = firstOpenUnit(course, states);

  if (keepingUp || waiting < 3) {
    // With nothing waiting, new material may fill the whole step.
    const reviewTime = Math.min(waiting * SECONDS.type, STEP_SECONDS - NEW_SECONDS);
    const budget = Math.max(NEW_SECONDS, STEP_SECONDS - spent - reviewTime);
    const planned = new Set<string>();
    let newSpent = 0;
    let ideas = 0;
    let vocab = 0;

    for (;;) {
      const next = nextIntro(course, states, planned);
      if (!next) break;
      if (next.entry.type === "grammar" && ideas >= MAX_NEW_IDEAS) break;
      if (next.entry.type !== "grammar" && vocab + next.entry.keys.length > MAX_NEW_VOCAB) break;

      const exercises = introduce(next.entry, course);
      const time = exercises.reduce((sum, exercise) => sum + cost(exercise, course), 0);
      if (newSpent > 0 && newSpent + time > budget) break;

      if (newSpent === 0) unitIndex = next.unitIndex;
      for (const exercise of exercises) add(fresh, exercise);
      for (const key of next.entry.type === "grammar" ? [next.entry.key] : next.entry.keys) {
        planned.add(key);
      }
      newSpent += time;
      if (next.entry.type === "grammar") ideas += 1;
      else vocab += next.entry.keys.length;
    }
  }

  // 3. Tricky items, one rung easier and with a reminder.
  for (const { item, state } of tricky.slice(0, 2)) {
    const exercise = reviewExercise(item, state, "tricky");
    if (exercise) add(mixed, exercise);
  }

  // 4. Due reviews, most overdue first.
  for (const { item, state } of due) {
    if (spent >= STEP_SECONDS || count >= MAX_EXERCISES) break;
    if (used.has(item.key)) continue;
    const exercise = reviewExercise(item, state, "review");
    if (exercise) add(mixed, exercise);
  }

  // 5. Nothing else due: practise what comes due soonest.
  if (spent < STEP_SECONDS * 0.75) {
    for (const { item, state } of known.filter(({ state }) => !isDue(state, now)).sort(byDue)) {
      if (spent >= STEP_SECONDS || count >= MAX_EXERCISES) break;
      if (used.has(item.key)) continue;
      const exercise = reviewExercise(item, state, "extra");
      if (exercise) add(mixed, exercise);
    }
  }

  // Shuffle the reviews, then finish on the easiest one.
  const shuffled = shuffle(mixed, random);
  const easiest = shuffled.reduce<number>((best, exercise, index) => {
    const stage = states.get(exercise.keys[0])?.stage ?? 0;
    const bestStage = best === -1 ? -1 : (states.get(shuffled[best].keys[0])?.stage ?? 0);
    return stage > bestStage ? index : best;
  }, -1);
  if (easiest >= 0) shuffled.push(...shuffled.splice(easiest, 1));

  return {
    exercises: [...warmup, ...fresh, ...shuffled],
    unitIndex: Math.min(unitIndex, Math.max(0, course.units.length - 1)),
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ---- Progress, for the home page and the end of a step. ---- */

export interface UnitProgress {
  index: number;
  id: string;
  code: string;
  title: string;
  level: string;
  learned: number;
  total: number;
  /**
   * 0–100, filling as items climb toward learned, so the first steps show
   * movement before anything is fully learned. Counts best stages, so it
   * never goes down; 100 means everything is learned.
   */
  percent: number;
  complete: boolean;
  started: boolean;
}

export function unitProgress(course: Course, states: Map<string, ItemState>): UnitProgress[] {
  return course.units.map((unit, index) => {
    const learned = unit.itemKeys.filter((key) => isLearned(states.get(key))).length;
    const climbed = unit.itemKeys.reduce(
      (sum, key) => sum + Math.min(LEARNED_STAGE, states.get(key)?.bestStage ?? 0),
      0,
    );
    const total = unit.itemKeys.length * LEARNED_STAGE;
    return {
      index,
      id: unit.id,
      code: unitCode(unit),
      title: unit.title,
      level: unit.level,
      learned,
      total: unit.itemKeys.length,
      percent: total > 0 ? Math.floor((climbed / total) * 100) : 0,
      complete: learned === unit.itemKeys.length,
      started: unit.itemKeys.some((key) => states.has(key)),
    };
  });
}

export type IdeaStatus = "new" | "learning" | "learned";

/** A unit's grammar ideas in teaching order, each with how far along it is. */
export function unitIdeas(
  course: Course,
  unitIndex: number,
  states: Map<string, ItemState>,
): { key: string; lessonId: string; section: number; heading: string; status: IdeaStatus }[] {
  const unit = course.units[unitIndex];
  if (!unit) return [];
  return unit.itemKeys
    .map((key) => course.items.get(key))
    .filter((item): item is GrammarItem => item?.kind === "grammar")
    .map((item) => {
      const state = states.get(item.key);
      return {
        key: item.key,
        lessonId: item.lessonId,
        section: item.section,
        heading: item.heading,
        status: !state ? "new" : isLearned(state) ? "learned" : "learning",
      };
    });
}

export function dueCount(course: Course, states: Map<string, ItemState>, now: Date): number {
  let count = 0;
  for (const [key, state] of states) {
    if (course.items.has(key) && isDue(state, now)) count += 1;
  }
  return count;
}
