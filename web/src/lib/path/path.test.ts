import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyAnswer, isLearned, newItemState, rungOf } from "./schedule";
import { firstOpenUnit, nextIntro, planStep, questionFor, unitProgress } from "./planner";
import { getCourse } from "./course";
import type { Course, CourseUnit, GrammarItem, Item, ItemState, WordItem } from "./types";

const NOW = new Date("2026-10-14T12:00:00Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const at = (ms: number) => new Date(NOW.getTime() + ms);

function state(overrides: Partial<ItemState> = {}): ItemState {
  return { ...newItemState(NOW), ...overrides };
}

describe("applyAnswer", () => {
  test("a new item answered right moves to stage 1 and comes back in ten minutes", () => {
    const after = applyAnswer(newItemState(NOW), { correct: true, rung: 1 }, NOW);
    assert.equal(after.stage, 1);
    assert.equal(after.bestStage, 1);
    assert.equal(after.dueAt.getTime(), at(10 * MINUTE).getTime());
  });

  test("right while not yet due is practice: no stage change, schedule kept", () => {
    const before = state({ stage: 2, bestStage: 2, dueAt: at(DAY) });
    const after = applyAnswer(before, { correct: true, rung: 5 }, NOW);
    assert.equal(after.stage, 2);
    assert.equal(after.dueAt.getTime(), before.dueAt.getTime());
    assert.equal(after.right, 1);
  });

  test("an exercise too easy for the next stage does not promote", () => {
    // Picking the meaning cannot prove the learner can produce the word.
    const after = applyAnswer(state({ stage: 2, bestStage: 2 }), { correct: true, rung: 1 }, NOW);
    assert.equal(after.stage, 2);
  });

  test("the schedule stretches stage by stage", () => {
    const intervals = [10 * MINUTE, DAY, 3 * DAY, 7 * DAY, 21 * DAY];
    let current = newItemState(NOW);
    let now = NOW;
    for (const interval of intervals) {
      current = applyAnswer(current, { correct: true, rung: 5 }, now);
      assert.equal(current.dueAt.getTime() - now.getTime(), interval);
      now = current.dueAt;
    }
    assert.equal(current.stage, 5);
    const maintained = applyAnswer(current, { correct: true, rung: 5 }, now);
    assert.equal(maintained.stage, 5);
    assert.equal(maintained.dueAt.getTime() - now.getTime(), 42 * DAY);
  });

  test("a miss drops one stage, keeps the best stage, and retries in ten minutes", () => {
    const after = applyAnswer(state({ stage: 3, bestStage: 3 }), { correct: false, rung: 5 }, NOW);
    assert.equal(after.stage, 2);
    assert.equal(after.bestStage, 3);
    assert.ok(isLearned(after), "progress never goes down");
    assert.equal(after.dueAt.getTime(), at(10 * MINUTE).getTime());
    assert.equal(applyAnswer(state(), { correct: false, rung: 1 }, NOW).stage, 0);
  });

  test("two misses in a row make an item tricky; two rights clear it", () => {
    let current = state({ stage: 2, bestStage: 2 });
    current = applyAnswer(current, { correct: false, rung: 5 }, NOW);
    assert.equal(current.tricky, false);
    current = applyAnswer(current, { correct: false, rung: 5 }, NOW);
    assert.equal(current.tricky, true);
    current = applyAnswer(current, { correct: true, rung: 1 }, NOW);
    assert.equal(current.tricky, true);
    current = applyAnswer(current, { correct: true, rung: 1 }, NOW);
    assert.equal(current.tricky, false);
  });

  test("rungs: picking proves recognition or recall, typing and questions prove more", () => {
    assert.equal(rungOf("recognize", "word"), 1);
    assert.equal(rungOf("recall", "phrase"), 2);
    assert.equal(rungOf("type", "word"), 5);
    assert.equal(rungOf("question", "grammar"), 5);
    assert.equal(rungOf("recognize", "grammar"), 0);
  });
});

/* ---- A small hand-made course for the planner. ---- */

function word(key: string, unitIndex: number): WordItem {
  return {
    kind: "word",
    key,
    unitIndex,
    target: key,
    accepted: [key],
    english: `${key}-en`,
    meanings: [`${key}-en`],
    group: "g",
  };
}

function grammar(key: string, unitIndex: number): GrammarItem {
  return {
    kind: "grammar",
    key,
    unitIndex,
    lessonId: "lesson",
    section: 1,
    heading: key,
    questions: [
      { index: 0, type: "choice" },
      { index: 1, type: "fill" },
      { index: 2, type: "translate" },
    ],
  };
}

function makeCourse(): Course {
  const items: Item[] = [];
  const units: CourseUnit[] = [];
  for (let u = 0; u < 4; u++) {
    const g1 = grammar(`g${u}a`, u);
    const g2 = grammar(`g${u}b`, u);
    const words = [0, 1, 2, 3, 4, 5].map((n) => word(`w${u}${n}`, u));
    items.push(g1, g2, ...words);
    units.push({
      id: `u${u}`,
      level: "a1",
      number: u + 1,
      title: `Unit ${u + 1}`,
      lessonIds: ["lesson"],
      itemKeys: [g1.key, g2.key, ...words.map((w) => w.key)],
      intro: [
        { type: "grammar", key: g1.key },
        { type: "words", keys: words.slice(0, 3).map((w) => w.key) },
        { type: "grammar", key: g2.key },
        { type: "words", keys: words.slice(3).map((w) => w.key) },
      ],
    });
  }
  return { language: "test", units, items: new Map(items.map((item) => [item.key, item])) };
}

const steady = () => 0.5;

describe("planStep", () => {
  const course = makeCourse();

  test("a first step teaches: a learn card, its questions, then new words", () => {
    const plan = planStep({ course, states: new Map(), now: NOW, recentAccuracy: null, random: steady });
    assert.deepEqual(
      plan.exercises.slice(0, 3).map((e) => e.mode),
      ["learn", "question", "question"],
    );
    assert.equal(plan.exercises[1].question, 0, "multiple choice first");
    assert.ok(plan.exercises.some((e) => e.mode === "meet"));
    assert.ok(plan.exercises.every((e) => e.role === "new"));
    assert.equal(plan.unitIndex, 0);
  });

  test("a step never teaches more than two ideas", () => {
    const plan = planStep({ course, states: new Map(), now: NOW, recentAccuracy: null, random: steady });
    assert.ok(plan.exercises.filter((e) => e.mode === "learn").length <= 2);
  });

  test("due items are reviewed at their stage's exercise", () => {
    const states = new Map<string, ItemState>([
      ["g0a", state({ stage: 1, bestStage: 1, dueAt: at(-MINUTE) })],
      ["w00", state({ stage: 0, dueAt: at(-MINUTE) })],
      ["w01", state({ stage: 1, bestStage: 1, dueAt: at(-MINUTE) })],
      ["w02", state({ stage: 2, bestStage: 2, dueAt: at(-MINUTE) })],
    ]);
    const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random: steady });
    const modeOf = (key: string) => plan.exercises.find((e) => e.keys[0] === key && e.role !== "new")?.mode;
    assert.equal(modeOf("w00"), "recognize");
    assert.equal(modeOf("w01"), "recall");
    assert.equal(modeOf("w02"), "type");
    assert.equal(modeOf("g0a"), "question");
  });

  test("a tricky word is asked one rung easier, a tricky idea with a reminder", () => {
    const states = new Map<string, ItemState>([
      ["w00", state({ stage: 2, bestStage: 3, tricky: true, dueAt: at(5 * MINUTE) })],
      ["g0a", state({ stage: 1, bestStage: 1, tricky: true, dueAt: at(5 * MINUTE) })],
    ]);
    const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random: steady });
    const tricky = plan.exercises.filter((e) => e.role === "tricky");
    assert.equal(tricky.find((e) => e.keys[0] === "w00")?.mode, "recall");
    assert.equal(tricky.find((e) => e.keys[0] === "g0a")?.reminder, true);
  });

  test("new material pauses when reviews pile up or recent steps went badly", () => {
    const backlog = new Map<string, ItemState>();
    for (const unit of course.units.slice(0, 3)) {
      for (const key of unit.itemKeys) backlog.set(key, state({ stage: 1, bestStage: 1, dueAt: at(-DAY) }));
    }
    const piledUp = planStep({ course, states: backlog, now: NOW, recentAccuracy: 1, random: steady });
    assert.ok(piledUp.exercises.every((e) => e.role !== "new"));

    const few = new Map<string, ItemState>([
      ["g0a", state({ stage: 1, dueAt: at(-MINUTE) })],
      ["w00", state({ stage: 1, dueAt: at(-MINUTE) })],
      ["w01", state({ stage: 1, dueAt: at(-MINUTE) })],
      ["w02", state({ stage: 1, dueAt: at(-MINUTE) })],
    ]);
    const struggling = planStep({ course, states: few, now: NOW, recentAccuracy: 0.5, random: steady });
    assert.ok(struggling.exercises.every((e) => e.role !== "new"));
  });

  test("with little to review, new material comes anyway", () => {
    const one = new Map<string, ItemState>([["g0a", state({ stage: 1, dueAt: at(-MINUTE) })]]);
    const plan = planStep({ course, states: one, now: NOW, recentAccuracy: 0.2, random: steady });
    assert.ok(plan.exercises.some((e) => e.role === "new"));
  });

  test("no item appears twice in a step, and the step ends on the easiest review", () => {
    const states = new Map<string, ItemState>();
    course.units[0].itemKeys.forEach((key, index) =>
      states.set(key, state({ stage: index % 4, bestStage: index % 4, dueAt: at(-MINUTE * (index + 1)) })),
    );
    const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random: Math.random });
    const keys = plan.exercises.filter((e) => e.mode !== "learn" && e.mode !== "meet" && e.role !== "new").map((e) => e.keys[0]);
    assert.equal(new Set(keys).size, keys.length);
    const reviewStages = plan.exercises
      .filter((e) => e.role === "review" || e.role === "tricky" || e.role === "extra")
      .map((e) => states.get(e.keys[0])?.stage ?? 0);
    assert.equal(reviewStages.at(-1), Math.max(...reviewStages));
  });

  test("new material runs at most one unit ahead of the oldest unfinished unit", () => {
    // Everything in units 0 and 1 introduced but not learned.
    const states = new Map<string, ItemState>();
    for (const unit of course.units.slice(0, 2)) {
      for (const key of unit.itemKeys) states.set(key, state({ stage: 1, bestStage: 1, dueAt: at(DAY) }));
    }
    assert.equal(firstOpenUnit(course, states), 0);
    assert.equal(nextIntro(course, states), null, "unit 2 waits until unit 0 is learned");

    for (const key of course.units[0].itemKeys) states.set(key, state({ stage: 3, bestStage: 3, dueAt: at(DAY) }));
    assert.equal(nextIntro(course, states)?.unitIndex, 2);
  });

  test("progress counts the best stage, so it only goes up", () => {
    const states = new Map<string, ItemState>([
      ["w00", state({ stage: 0, bestStage: 3 })],
      ["w01", state({ stage: 2, bestStage: 2 })],
    ]);
    const [first] = unitProgress(course, states);
    assert.equal(first.learned, 1);
    assert.equal(first.total, 8);
    assert.equal(first.started, true);
    // Partial credit for climbing: (3 + 2) of a possible 8 × 3.
    assert.equal(first.percent, Math.floor((5 / 24) * 100));
  });

  test("questions rotate within the preferred type, translation once familiar", () => {
    const item = grammar("g", 0);
    assert.equal(questionFor(item, undefined), 0);
    assert.equal(questionFor(item, state({ stage: 1 })), 1);
    assert.equal(questionFor(item, state({ stage: 3 })), 2);
    assert.equal(questionFor(item, undefined, new Set([0])), 1);
  });
});

describe("course from the real curriculum", () => {
  for (const language of ["italian", "spanish", "french", "portuguese"]) {
    test(`${language}: ten A1 units, every item introduced exactly once`, () => {
      const course = getCourse(language);
      assert.equal(course.units.filter((unit) => unit.level === "a1").length, 10);

      const introduced: string[] = [];
      for (const unit of course.units) {
        for (const entry of unit.intro) {
          if (entry.type === "grammar") introduced.push(entry.key);
          else introduced.push(...entry.keys);
        }
      }
      assert.equal(new Set(introduced).size, introduced.length, "no item is introduced twice");
      assert.equal(introduced.length, course.items.size, "every item is introduced");

      for (const item of course.items.values()) {
        if (item.kind === "grammar") assert.ok(item.questions.length > 0, `${item.key} has questions`);
      }
    });
  }

  test("the first step of Italian starts with lesson 1, section 1", () => {
    const course = getCourse("italian");
    const plan = planStep({ course, states: new Map(), now: NOW, recentAccuracy: null, random: steady });
    assert.equal(plan.exercises[0].mode, "learn");
    assert.equal(plan.exercises[0].keys[0], "g:italian-a1-01-greetings#1");
  });
});
