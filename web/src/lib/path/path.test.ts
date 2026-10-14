import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyAnswer,
  applyChallenge,
  assumeKnown,
  completeDialogue,
  isLearned,
  LEARNED_STAGE,
  MAX_STAGE,
  newItemState,
  rungOf,
} from "./schedule";
import { completedLevels, daysToFinish, levelProgress } from "./levels";
import {
  dialogueReady,
  firstOpenUnit,
  grammarPick,
  nextIntro,
  planChallenge,
  planStep,
  raisedMarks,
  typedTurns,
  unitProgress,
} from "./planner";
import { getCourse } from "./course";
import { presentStep } from "./present";
import { gradeReply } from "./sentences";
import type {
  Course,
  CourseDialogue,
  CourseUnit,
  GrammarItem,
  Item,
  ItemState,
  LadderMode,
  Sentence,
  WordItem,
} from "./types";

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

  test("rungs follow the item's ladder; its top rung proves everything above", () => {
    const full = word("full", 0, ["recognize", "recall", "type", "cloze", "reply"]);
    assert.equal(rungOf("recognize", full), 1);
    assert.equal(rungOf("recall", full), 2);
    assert.equal(rungOf("type", full), 3);
    assert.equal(rungOf("cloze", full), 4);
    assert.equal(rungOf("reply", full), MAX_STAGE);

    // No sentence or role-play uses this word: typing is as far as it goes.
    const plain = word("plain", 0);
    assert.equal(rungOf("type", plain), MAX_STAGE);
    assert.equal(rungOf("cloze", plain), 0);

    assert.equal(rungOf("question", grammar("g", 0)), MAX_STAGE);
    assert.equal(rungOf("build", grammar("g", 0)), MAX_STAGE);
    assert.equal(rungOf("recognize", grammar("g", 0)), 0);
  });

  test("a challenge: right counts as learned at once, wrong costs nothing", () => {
    const right = applyChallenge(state({ stage: 1, bestStage: 1 }), true, NOW);
    assert.equal(right.stage, LEARNED_STAGE);
    assert.ok(isLearned(right));
    assert.equal(right.dueAt.getTime(), at(3 * DAY).getTime(), "confirmed in a few days");

    const wrong = applyChallenge(state({ stage: 2, bestStage: 2 }), false, NOW);
    assert.equal(wrong.stage, 2);
    assert.equal(wrong.wrong, 1);

    const high = state({ stage: 4, bestStage: 4, dueAt: at(5 * DAY) });
    assert.equal(applyChallenge(high, true, NOW).dueAt.getTime(), high.dueAt.getTime(), "never lowers or reschedules");
  });

  test("a passed unit takes the rest as probably known, confirmed later", () => {
    const fresh = assumeKnown(newItemState(NOW), NOW, 5);
    assert.equal(fresh.bestStage, LEARNED_STAGE);
    assert.equal(fresh.dueAt.getTime(), at(5 * DAY).getTime());
    const known = state({ stage: 5, bestStage: 5 });
    assert.equal(assumeKnown(known, NOW, 5), known);
  });

  test("a role-play comes round less and less often", () => {
    let played = completeDialogue(newItemState(NOW), NOW);
    assert.equal(played.right, 1);
    assert.equal(played.dueAt.getTime(), at(DAY).getTime());
    played = completeDialogue(played, played.dueAt);
    assert.equal(played.dueAt.getTime(), at(DAY + 3 * DAY).getTime());
  });
});

/* ---- A small hand-made course for the planner. ---- */

function word(key: string, unitIndex: number, ladder: LadderMode[] = ["recognize", "recall", "type"]): WordItem {
  return {
    kind: "word",
    key,
    unitIndex,
    target: key,
    accepted: [key],
    english: `${key}-en`,
    meanings: [`${key}-en`],
    group: "g",
    ladder,
    clozes: ladder.includes("cloze") ? [`s:${key}`] : [],
    replies: ladder.includes("reply") ? [{ dialogue: "d:chat", line: 1 }] : [],
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
    builds: [],
  };
}

/**
 * Four units of two ideas and six words. In unit 0, w04 has a sentence to be
 * blanked out of and w05 a role-play turn too.
 */
function makeCourse(): Course {
  const items: Item[] = [];
  const units: CourseUnit[] = [];
  const sentences = new Map<string, Sentence>();
  for (let u = 0; u < 4; u++) {
    const g1 = grammar(`g${u}a`, u);
    const g2 = grammar(`g${u}b`, u);
    const words = [0, 1, 2, 3, 4, 5].map((n) =>
      u === 0 && n === 4
        ? word("w04", 0, ["recognize", "recall", "type", "cloze"])
        : u === 0 && n === 5
          ? word("w05", 0, ["recognize", "recall", "type", "cloze", "reply"])
          : word(`w${u}${n}`, u),
    );
    for (const item of words) {
      for (const id of item.clozes) {
        sentences.set(id, { id, target: `a ${item.key} b`, english: "a … b", group: "g", unitIndex: u });
      }
    }
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
  const chat: CourseDialogue = {
    key: "d:chat",
    unitIndex: 0,
    title: "Chat",
    setting: "A chat.",
    with: "a friend",
    lines: [
      { kind: "them", target: "ciao", english: "hi" },
      { kind: "you", instruction: "Say w05", answers: ["w05"], itemKeys: ["w05"] },
      { kind: "them", target: "e poi?", english: "and then?" },
      { kind: "you", instruction: "Say w00", answers: ["w00"], itemKeys: ["w00"] },
    ],
    itemKeys: ["w05", "w00"],
  };
  return {
    language: "test",
    units,
    items: new Map(items.map((item) => [item.key, item])),
    sentences,
    dialogues: new Map([[chat.key, chat]]),
  };
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

  test("a tricky item gets a reminder card first, then is asked one rung easier later on", () => {
    const states = new Map<string, ItemState>([
      ["w00", state({ stage: 2, bestStage: 3, tricky: true, dueAt: at(5 * MINUTE) })],
      ["g0a", state({ stage: 1, bestStage: 1, tricky: true, dueAt: at(5 * MINUTE) })],
    ]);
    const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random: steady });
    const positions = (key: string) =>
      plan.exercises.flatMap((e, index) => (e.keys[0] === key && e.role === "tricky" ? [{ mode: e.mode, index }] : []));

    const word = positions("w00");
    assert.deepEqual(word.map((e) => e.mode), ["remind", "recall"]);
    assert.ok(word[1].index > word[0].index);
    assert.equal(positions("g0a")[0].mode, "remind");
  });

  test("words climb into sentences and role-play turns as their stage rises", () => {
    const states = new Map<string, ItemState>([
      ["w04", state({ stage: 3, bestStage: 3, dueAt: at(-MINUTE) })],
      ["w05", state({ stage: 4, bestStage: 4, dueAt: at(-MINUTE) })],
    ]);
    const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random: steady });
    const of = (key: string) => plan.exercises.find((e) => e.keys[0] === key);
    assert.equal(of("w04")?.mode, "cloze");
    assert.equal(of("w04")?.sentence, "s:w04");
    assert.equal(of("w05")?.mode, "reply");
    assert.deepEqual(of("w05")?.reply, { dialogue: "d:chat", line: 1 });
  });

  test("a role-play opens once its words are met and mostly recalled, then is offered when due", () => {
    const chat = course.dialogues.get("d:chat")!;
    const met = new Map<string, ItemState>([["w05", state({ stage: 2, bestStage: 2, dueAt: at(DAY) })]]);
    assert.equal(dialogueReady(chat, course, met), false, "w00 not met yet");

    met.set("w00", state({ stage: 1, bestStage: 1, dueAt: at(DAY) }));
    assert.equal(dialogueReady(chat, course, met), false, "only half recalled");

    met.set("w00", state({ stage: 2, bestStage: 2, dueAt: at(DAY) }));
    assert.equal(dialogueReady(chat, course, met), true);

    const plan = planStep({ course, states: met, now: NOW, recentAccuracy: 1, random: steady });
    const roleplay = plan.exercises.find((e) => e.mode === "dialogue");
    assert.equal(roleplay?.keys[0], "d:chat");
    assert.deepEqual(roleplay?.typed, [false, false], "picked the first time");

    met.set("d:chat", state({ right: 1, dueAt: at(DAY) }));
    const later = planStep({ course, states: met, now: NOW, recentAccuracy: 1, random: steady });
    assert.ok(!later.exercises.some((e) => e.mode === "dialogue"), "not again until it is due");
  });

  test("the second time through, turns the learner can type are typed; after that, all", () => {
    const chat = course.dialogues.get("d:chat")!;
    const states = new Map<string, ItemState>([
      ["w05", state({ stage: 3, bestStage: 3 })],
      ["w00", state({ stage: 2, bestStage: 2 })],
    ]);
    assert.deepEqual(typedTurns(chat, undefined, states), [false, false]);
    assert.deepEqual(typedTurns(chat, state({ right: 1 }), states), [true, false]);
    assert.deepEqual(typedTurns(chat, state({ right: 2 }), states), [true, true]);
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

  test("a challenge covers the unit's ideas and its unlearned words first, at the learned rung", () => {
    const states = new Map<string, ItemState>([
      ["w00", state({ stage: 3, bestStage: 3 })],
      ["w01", state({ stage: 1, bestStage: 1 })],
    ]);
    const plan = planChallenge(course, 0, states, steady);
    assert.ok(plan.exercises.every((e) => e.role === "challenge"));
    assert.ok(plan.exercises.length <= 16);
    const keys = plan.exercises.map((e) => e.keys[0]);
    assert.ok(keys.includes("g0a") && keys.includes("g0b"), "every idea");
    assert.ok(keys.includes("w01"));
    // Six words in the unit, seven slots: the learned one too, but last in line.
    for (const exercise of plan.exercises) {
      const item = course.items.get(exercise.keys[0]);
      if (item?.kind === "word") assert.equal(exercise.mode, "type");
      if (item?.kind === "grammar") assert.ok(exercise.mode === "question" || exercise.mode === "build");
    }
  });

  test("level progress: a bar per kind, complete when every unit is", () => {
    const states = new Map<string, ItemState>();
    for (const key of course.units[0].itemKeys) states.set(key, state({ stage: 3, bestStage: 3 }));
    const progress = levelProgress(course, states, "a1");
    assert.equal(progress.units.length, 4);
    assert.equal(progress.words.done, 6);
    assert.equal(progress.words.total, 24);
    assert.equal(progress.grammar.done, 2);
    assert.equal(progress.percent, 25);
    assert.equal(progress.complete, false);
    assert.equal(progress.speaking.total, 1);
    assert.equal(progress.speaking.done, 0);

    for (const unit of course.units) for (const key of unit.itemKeys) states.set(key, state({ stage: 3, bestStage: 3 }));
    states.set("d:chat", state({ right: 1 }));
    const done = levelProgress(course, states, "a1");
    assert.equal(done.complete, true);
    assert.equal(done.speaking.done, 1);
    assert.deepEqual(completedLevels(course, states), ["a1"]);
  });

  test("new content in a unit never lowers its bar: the best it showed is kept", () => {
    const states = new Map<string, ItemState>([["w00", state({ stage: 3, bestStage: 3 })]]);
    const now = unitProgress(course, states)[0];
    assert.equal(now.percent, Math.floor((3 / 24) * 100));

    // The learner once saw 40% here, before words were added to the unit.
    const marks = new Map([["u0", { bestPercent: 40, complete: false }]]);
    assert.equal(unitProgress(course, states, marks)[0].percent, 40);
    assert.deepEqual(raisedMarks(unitProgress(course, states, marks), marks), [], "nothing to raise");

    // A unit once complete stays complete.
    const done = unitProgress(course, states, new Map([["u0", { bestPercent: 100, complete: true }]]))[0];
    assert.equal(done.complete, true);
    assert.equal(done.percent, 100);

    // Progress above the mark raises it.
    for (const key of course.units[1].itemKeys) states.set(key, state({ stage: 2, bestStage: 2 }));
    assert.deepEqual(raisedMarks(unitProgress(course, states, marks), marks).map((m) => m.unitId), ["u1"]);
  });

  test("days to finish at the learner's pace, once there is something to go on", () => {
    // 10 hours covered 25%: 30 more hours at 30 minutes a day is 60 days.
    assert.equal(daysToFinish(25, 10, 30), 60);
    assert.equal(daysToFinish(0, 10, 30), null);
    assert.equal(daysToFinish(25, 0.1, 30), null);
    assert.equal(daysToFinish(25, 10, 0), null);
  });

  test("ideas start with multiple choice, add sentence building, and lead with translation once familiar", () => {
    const item = { ...grammar("g", 0), builds: ["s:example"] };
    assert.deepEqual(grammarPick(item, undefined), { mode: "question", question: 0 });
    assert.deepEqual(grammarPick(item, undefined, new Set(["q0"])), { mode: "question", question: 1 });
    assert.deepEqual(grammarPick(item, state({ stage: 1 })), { mode: "question", question: 1 });
    assert.deepEqual(grammarPick(item, state({ stage: 1, right: 2 })), { mode: "build", sentence: "s:example" });
    assert.deepEqual(grammarPick(item, state({ stage: 3 })), { mode: "question", question: 2 });
    assert.deepEqual(grammarPick(item, state({ stage: 3, right: 1 })), { mode: "build", sentence: "s:example" });

    // Only translations: still asked, even when new.
    const hard = { ...grammar("h", 0), questions: [{ index: 4, type: "translate" as const }] };
    assert.deepEqual(grammarPick(hard, undefined), { mode: "question", question: 4 });
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

  for (const language of ["italian", "spanish", "french", "portuguese"]) {
    test(`${language}: every sentence and role-play turn an item points at exists and fits`, () => {
      const course = getCourse(language);
      for (const item of course.items.values()) {
        if (item.kind === "grammar") {
          for (const id of item.builds) assert.ok(course.sentences.has(id), id);
          continue;
        }
        for (const reply of item.replies) {
          const dialogue = course.dialogues.get(reply.dialogue);
          assert.ok(dialogue && dialogue.unitIndex >= item.unitIndex, `${item.key} → ${reply.dialogue}`);
          assert.equal(dialogue.lines[reply.line]?.kind, "you");
        }
        if (item.kind === "word") {
          for (const id of item.clozes) assert.ok(course.sentences.has(id), id);
        }
        assert.equal(item.ladder.slice(0, 2).join(), "recognize,recall");
      }
    });

    test(`${language}: a learner at every stage gets a step where every card can be shown`, () => {
      const course = getCourse(language);
      const states = new Map<string, ItemState>();
      // Units 0–3 introduced, at a spread of stages, all due; role-plays never played.
      let n = 0;
      for (const unit of course.units.slice(0, 4)) {
        for (const key of unit.itemKeys) {
          const stage = n++ % 6;
          states.set(key, state({ stage, bestStage: stage, right: n, dueAt: at(-MINUTE) }));
        }
      }
      for (let seed = 0; seed < 20; seed++) {
        let x = seed + 1;
        const random = () => ((x = (x * 16807) % 2147483647) / 2147483647);
        const plan = planStep({ course, states, now: NOW, recentAccuracy: 1, random });
        const step = presentStep(course, plan, random);
        assert.equal(step.exercises.length, plan.exercises.length, "no card dropped");
      }
    });
  }

  for (const language of ["italian", "spanish", "french", "portuguese"]) {
    test(`${language}: every picked role-play turn has exactly one acceptable option`, () => {
      const course = getCourse(language);
      for (const dialogue of course.dialogues.values()) {
        const turns = dialogue.lines.filter((line) => line.kind === "you").length;
        const step = presentStep(
          course,
          { unitIndex: 0, exercises: [{ mode: "dialogue", keys: [dialogue.key], typed: Array(turns).fill(false), role: "stretch" }] },
          Math.random,
        );
        const shown = step.exercises[0];
        assert.equal(shown?.mode, "dialogue");
        if (shown?.mode !== "dialogue") continue;
        for (const line of shown.lines) {
          if (line.kind !== "you") continue;
          const turn = dialogue.lines[line.line];
          if (turn.kind !== "you") continue;
          assert.ok(line.options?.includes(turn.answers[0]), `${dialogue.key}: model answer offered`);
          const acceptable = line.options!.filter((option) => gradeReply(option, turn.answers).verdict !== "incorrect");
          assert.deepEqual(acceptable, [turn.answers[0]], `${dialogue.key} line ${line.line}`);
          assert.ok(line.options!.length >= 2, `${dialogue.key} line ${line.line} has a wrong option`);
        }
      }
    });
  }

  for (const language of ["italian", "spanish", "french", "portuguese"]) {
    test(`${language}: every unit's challenge can be shown in full`, () => {
      const course = getCourse(language);
      course.units.forEach((unit, index) => {
        const plan = planChallenge(course, index, new Map(), Math.random);
        assert.ok(plan.exercises.length >= 8, `${unit.id} has a real challenge`);
        const step = presentStep(course, plan, Math.random);
        assert.equal(step.exercises.length, plan.exercises.length, `${unit.id}: no card dropped`);
        assert.equal(step.challenge, true);
      });
    });
  }

  test("the first step of Italian starts with lesson 1, section 1", () => {
    const course = getCourse("italian");
    const plan = planStep({ course, states: new Map(), now: NOW, recentAccuracy: null, random: steady });
    assert.equal(plan.exercises[0].mode, "learn");
    assert.equal(plan.exercises[0].keys[0], "g:italian-a1-01-greetings#1");
  });
});
