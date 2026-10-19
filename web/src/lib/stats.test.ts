import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, type StatsInput } from "./stats";

// Monday 19 October 2026, noon UTC. Values below were worked out by hand from the definitions in stats.ts.
const NOW = new Date("2026-10-19T12:00:00Z");
const at = (day: string) => new Date(`${day}T09:00:00Z`);

const FIXTURE: StatsInput = {
  now: NOW,
  users: [
    { id: "a", createdAt: at("2026-10-01"), inviteCodeId: "c1", streakDays: 3 },
    { id: "b", createdAt: at("2026-10-03"), inviteCodeId: "c1", streakDays: 0 },
    { id: "c", createdAt: at("2026-10-15"), inviteCodeId: "c2", streakDays: 0 },
    { id: "d", createdAt: at("2026-10-17"), inviteCodeId: "c2", streakDays: 1 },
    { id: "e", createdAt: at("2026-09-01"), inviteCodeId: null, streakDays: 12 },
  ],
  codes: [
    { id: "c1", note: "family", createdAt: at("2026-09-30") },
    { id: "c2", note: "friends", createdAt: at("2026-10-14") },
  ],
  practice: [
    { userId: "a", day: "2026-10-01", steps: 2 }, // day 0: activated
    { userId: "a", day: "2026-10-02", steps: 1 }, // day 1
    { userId: "a", day: "2026-10-08", steps: 1 }, // day 7: week 2
    { userId: "a", day: "2026-10-19", steps: 1 }, // today
    { userId: "b", day: "2026-10-05", steps: 1 }, // day 2: activated, never back in week 2
    { userId: "d", day: "2026-10-17", steps: 1 }, // day 0: activated, week 2 still to come
    { userId: "e", day: "2026-09-02", steps: 0 }, // day 1, flashcards only: back, but not a step
    { userId: "e", day: "2026-10-01", steps: 1 }, // day 30
  ],
  frontVisitors: [
    { day: "2026-10-19", visitors: 3 },
    { day: "2026-10-18", visitors: 2 },
    { day: "2026-09-01", visitors: 4 },
  ],
  inviteOpens: [
    { inviteCodeId: "c1", total: 4, recent: 3 },
    { inviteCodeId: "c2", total: 2, recent: 2 },
  ],
  appOpened: [
    { userId: "a", day: "2026-10-19" }, // practised
    { userId: "d", day: "2026-10-18" }, // didn't
    { userId: "c", day: "2026-10-16" }, // didn't
  ],
  stepsStarted: 10,
  eventDays: [
    { day: "2026-10-19", events: 30, heartbeats: 12 },
    { day: "2026-10-17", events: 40, heartbeats: 24 },
  ],
  remindersOn: 2,
};

describe("usage dashboard, against a hand-computed fixture", () => {
  const stats = computeStats(FIXTURE);
  const counts = (stages: typeof stats.funnel30) => stages.map((stage) => [stage.count, stage.conversion, stage.pending ?? null]);

  test("funnel, last 30 days", () => {
    // 5 visitor-days → 5 opens → 4 signups (a, b, c, d) → 3 activated of 3 who've had a week → 1 back in week 2 of 2 who've had two.
    assert.deepEqual(counts(stats.funnel30), [
      [5, null, null],
      [5, 100, null],
      [4, 80, null],
      [3, 100, 1],
      [1, 50, 1],
    ]);
  });

  test("funnel, all time", () => {
    // e never finished a step in week 1: activated 3 of 4 who've had a week.
    assert.deepEqual(counts(stats.funnelAll), [
      [9, null, null],
      [6, 67, null],
      [5, 83, null],
      [3, 75, 1],
      [1, 50, 1],
    ]);
  });

  test("retention: of those old enough, who practised on day 1, 7 and 30", () => {
    assert.deepEqual(stats.retention, [
      { day: 1, share: 40, n: 5 }, // a and e
      { day: 7, share: 33, n: 3 }, // a, of a, b, e
      { day: 30, share: 100, n: 1 }, // e
    ]);
  });

  test("engagement over the last 30 days", () => {
    const { streaks, ...rest } = stats.engagement;
    assert.deepEqual(rest, {
      activeToday: 1,
      dailyAverage: 0.2, // 7 learner-days over 30 days
      weekly: 2, // a and d
      monthly: 4, // a, b, d, e
      stickiness: 5,
      openedNotPractised: 67, // d and c, of 3 opens
      appOpens: 3,
      stepsStarted: 10,
      stepsFinished: 8,
      finishedShare: 80,
      stepsPerActiveDay: 1.1, // 8 steps over 7 learner-days with a step
      remindersOn: 2,
    });
    assert.ok(streaks.every((bucket) => bucket.learners === "<5"), "every streak bucket is under five learners");
  });

  test("health: a past day with no heartbeat, or steps with no events, is flagged", () => {
    const flagged = stats.health.filter((day) => day.broken).map((day) => day.day);
    assert.ok(flagged.includes("2026-10-18"), "no heartbeat");
    assert.ok(flagged.includes("2026-10-08"), "a step but no events");
    assert.ok(!flagged.includes("2026-10-17") && !flagged.includes("2026-10-19"));
  });

  test("small breakdowns read <5: two two-person codes are pooled, and their numbers hidden", () => {
    assert.deepEqual(stats.codes, [
      { label: "Personal and small invites (2 codes)", made: null, opened: "<5", signedUp: "<5", activated: "<5", weekTwo: "<5" },
    ]);
    assert.ok(stats.cohorts.every((cohort) => cohort.size === "<5" && cohort.weeks.every((cell) => cell === "<5" || cell === null)));
  });
});

describe("per-code rows (single-use invites)", () => {
  const user = (id: string, code: string, day = "2026-10-05") => ({ id, createdAt: at(day), inviteCodeId: code, streakDays: 0 });
  const base = { ...FIXTURE, practice: [], appOpened: [], frontVisitors: [], inviteOpens: [] };

  test("a code gets its own row at five signups; single-use codes are pooled", () => {
    const campaign = ["p1", "p2", "p3", "p4", "p5"].map((id) => user(id, "camp"));
    const personal = ["s1", "s2", "s3", "s4"].map((id, i) => user(id, `single${i}`));
    const stats = computeStats({
      ...base,
      users: [...campaign, ...personal],
      codes: [
        { id: "camp", note: "school newsletter", createdAt: at("2026-10-01") },
        ...personal.map((_, i) => ({ id: `single${i}`, note: `for someone ${i}`, createdAt: at("2026-10-02") })),
      ],
    });
    assert.deepEqual(stats.codes, [
      { label: "school newsletter", made: "2026-10-01", opened: 0, signedUp: 5, activated: 0, weekTwo: 0 },
      { label: "Personal and small invites (4 codes)", made: null, opened: "<5", signedUp: "<5", activated: "<5", weekTwo: "<5" },
    ]);
    assert.ok(!JSON.stringify(stats.codes).includes("for someone"), "no personal invite's note is shown");
  });

  test("four signups on one code stay pooled", () => {
    const stats = computeStats({
      ...base,
      users: ["q1", "q2", "q3", "q4"].map((id) => user(id, "four")),
      codes: [{ id: "four", note: "almost a campaign", createdAt: at("2026-10-01") }],
    });
    assert.equal(stats.codes.length, 1);
    assert.equal(stats.codes[0].signedUp, "<5");
  });

  test("a cohort of five shows its weekly shares", () => {
    const cohort = ["w1", "w2", "w3", "w4", "w5"].map((id) => user(id, "camp", "2026-10-05"));
    const stats = computeStats({
      ...base,
      users: cohort,
      codes: [{ id: "camp", note: "x", createdAt: at("2026-10-01") }],
      practice: [
        { userId: "w1", day: "2026-10-05", steps: 1 },
        { userId: "w2", day: "2026-10-06", steps: 1 },
        { userId: "w1", day: "2026-10-12", steps: 1 },
      ],
    });
    // Week of Monday 5 October: week 0 → w1, w2 (40%); week 1 → w1 (20%); week 2 → nobody.
    assert.deepEqual(stats.cohorts, [{ week: "2026-10-05", size: 5, weeks: [40, 20, 0] }]);
  });
});
