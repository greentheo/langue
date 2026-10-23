import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, SMALL, utcDay, type StatsInput } from "./stats";

// Monday 19 October 2026, noon UTC. Values below were worked out by hand from the definitions in stats.ts.
const NOW = new Date("2026-10-19T12:00:00Z");
const at = (day: string, hour = 9) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

const PRACTICE = [
  { userId: "a", day: "2026-10-01", steps: 2 }, // day 0: activated
  { userId: "a", day: "2026-10-02", steps: 1 }, // day 1
  { userId: "a", day: "2026-10-08", steps: 1 }, // day 7: week 2
  { userId: "a", day: "2026-10-19", steps: 1 }, // today
  { userId: "b", day: "2026-10-05", steps: 1 }, // day 2: activated, never back in week 2
  { userId: "d", day: "2026-10-17", steps: 1 }, // day 0: activated, week 2 still to come
  { userId: "e", day: "2026-09-02", steps: 0 }, // day 1, flashcards only: back, but not a step
  { userId: "e", day: "2026-10-01", steps: 1 }, // day 30
];

/** Every finished step in a practice list, at 10:00 that day. */
const finishes = (practice: { userId: string; day: string; steps: number }[]) =>
  practice.flatMap((row) => Array.from({ length: row.steps }, () => ({ userId: row.userId, at: at(row.day, 10) })));

const FIXTURE: StatsInput = {
  now: NOW,
  trackingSince: at("2026-08-01"), // events from before anyone joined
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
  practice: PRACTICE,
  stepFinishes: finishes(PRACTICE).filter((step) => step.at >= at("2026-09-20", 0)),
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
    { userId: "a", at: at("2026-10-19") }, // a step at 10:00: practised
    { userId: "d", at: at("2026-10-18") }, // no step within three hours
    { userId: "c", at: at("2026-10-16") }, // none at all
  ],
  stepsStarted: 10,
  eventDays: [
    { day: "2026-10-19", events: 30, heartbeats: 12 },
    { day: "2026-10-17", events: 40, heartbeats: 24 },
  ],
  remindersOn: 2,
};

const counts = (stages: { count: number; conversion: number | null; pending?: number }[]) =>
  stages.map((stage) => [stage.count, stage.conversion, stage.pending ?? null]);

describe("usage dashboard, against a hand-computed fixture", () => {
  const stats = computeStats(FIXTURE);

  test("funnel, last 30 days: visits, invite opens and signups only", () => {
    // 5 visitor-days → 5 opens → 4 signups (a, b, c, d). What people did after signing up is shown all time only.
    assert.equal(stats.windows[0].title, "Last 30 days");
    assert.deepEqual(counts(stats.windows[0].funnel), [
      [5, null, null],
      [5, 100, null],
      [4, 80, null],
    ]);
  });

  test("funnel, all time", () => {
    // e never finished a step in week 1: activated 3 of 4 who've had a week.
    assert.deepEqual(counts(stats.windows[1].funnel), [
      [9, null, null],
      [6, 67, null],
      [5, 83, null],
      [3, 75, 1],
      [1, 50, 1],
    ]);
  });

  test("retention: of those old enough, who practised on day 1, 7 and 30; under five people reads <5", () => {
    assert.deepEqual(stats.retention, [
      { day: 1, share: 40, n: 5 }, // a and e
      { day: 7, share: "<5", n: 3 }, // a, of a, b, e: too few to show
      { day: 30, share: "<5", n: 1 }, // e alone
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
      appOpensPending: 0, // a's open at 09:00 is exactly three hours old: judged
      stepsStarted: 10,
      stepsFinished: 8,
      finishedShare: 80,
      stepsPerActiveDay: 1.1, // 8 steps over 7 learner-days with a step
      remindersOn: 2,
    });
    assert.ok(streaks.every((bucket) => bucket.learners === "<5"), "every streak bucket is under five learners");
  });

  test("opened the app, and no step finished within three hours — across midnight too", () => {
    const open = (userId: string, when: Date) => computeStats({ ...FIXTURE, appOpened: [{ userId, at: when }] }).engagement.openedNotPractised;
    // a finished a step at 10:00 on 19 October.
    assert.equal(open("a", at("2026-10-19", 8)), 0, "two hours before: practised");
    assert.equal(open("a", at("2026-10-19", 6)), 100, "four hours before: not");
    // A session that opens before UTC midnight and finishes after it still counts as practised.
    const lateNight = { ...FIXTURE, stepFinishes: [{ userId: "d", at: new Date("2026-10-19T00:30:00Z") }] };
    assert.equal(computeStats({ ...lateNight, appOpened: [{ userId: "d", at: new Date("2026-10-18T23:00:00Z") }] }).engagement.openedNotPractised, 0);
  });

  test("an open under three hours old is pending: neither practised nor not", () => {
    const { engagement } = computeStats({ ...FIXTURE, appOpened: [...FIXTURE.appOpened, { userId: "b", at: new Date("2026-10-19T10:30:00Z") }] });
    assert.equal(engagement.openedNotPractised, 67, "still d and c, of the 3 old enough to tell");
    assert.equal(engagement.appOpens, 3);
    assert.equal(engagement.appOpensPending, 1);
  });

  test("health: a past day with no heartbeat, or steps with no events, is flagged", () => {
    const flagged = stats.health.filter((day) => day.broken).map((day) => day.day);
    assert.ok(flagged.includes("2026-10-18"), "no heartbeat");
    assert.ok(flagged.includes("2026-10-08"), "a step but no events");
    assert.ok(!flagged.includes("2026-10-17") && !flagged.includes("2026-10-19"));
  });

  test("small codes are pooled with learners who joined without one, and hidden under five", () => {
    // Last 30 days: a, b, c, d on two two-person codes.
    assert.deepEqual(stats.windows[0].codes, [
      { label: "Everyone else: 2 smaller codes", made: null, opened: "<5", signedUp: "<5" },
    ]);
    // All time: e joined without a code; five people, the whole app, so the numbers can show.
    assert.deepEqual(stats.windows[1].codes, [
      { label: "Everyone else: 2 smaller codes, and learners who joined without one", made: null, opened: 6, signedUp: 5, activated: 3, weekTwo: 1 },
    ]);
    assert.ok(stats.cohorts.every((cohort) => cohort.size === "<5" && cohort.weeks.every((cell) => cell === "<5" || cell === null)));
  });
});

describe("before tracking began: learners and steps older than the first event", () => {
  // Production's shape: people joined and practised for weeks; the first event is on 17 October at 15:00.
  const practice = [
    { userId: "f3", day: "2026-09-25", steps: 1 },
    { userId: "f4", day: "2026-10-10", steps: 1 }, // before tracking
    { userId: "f4", day: "2026-10-18", steps: 1 },
    { userId: "x", day: "2026-10-18", steps: 1 },
  ];
  const stats = computeStats({
    ...FIXTURE,
    trackingSince: at("2026-10-17", 15),
    users: [
      { id: "o", createdAt: at("2026-08-20"), inviteCodeId: null, streakDays: 0 },
      { id: "f3", createdAt: at("2026-09-25"), inviteCodeId: null, streakDays: 0 },
      { id: "f4", createdAt: at("2026-10-10"), inviteCodeId: null, streakDays: 0 },
      { id: "x", createdAt: at("2026-10-18", 10), inviteCodeId: "camp", streakDays: 0 },
    ],
    codes: [{ id: "camp", note: "autumn", createdAt: at("2026-10-16") }],
    practice,
    stepFinishes: finishes(practice),
    frontVisitors: [{ day: "2026-10-18", visitors: 4 }],
    inviteOpens: [{ inviteCodeId: "camp", total: 2, recent: 2 }],
    appOpened: [],
    stepsStarted: 2,
    eventDays: [
      { day: "2026-10-17", events: 5, heartbeats: 3 },
      { day: "2026-10-18", events: 20, heartbeats: 24 },
      { day: "2026-10-19", events: 9, heartbeats: 12 },
    ],
  });

  test("invite pages opened → signed up counts only signups since tracking began, and says so", () => {
    // Three signups in the last 30 days (f3, f4, x), one of them since tracking: 1 of 2 opens.
    const signedUp = stats.windows[0].funnel[2];
    assert.equal(signedUp.count, 3);
    assert.equal(signedUp.conversion, 50);
    assert.equal(signedUp.note, "1 of them since tracking began on 2026-10-17");
    assert.equal(stats.trackingSince, "2026-10-17");
  });

  test("steps finished are compared with steps started only since tracking began", () => {
    // Started 2 (events); finished 3 in 30 days, but 2 since 17 October 15:00.
    assert.equal(stats.engagement.stepsFinished, 2);
    assert.equal(stats.engagement.finishedShare, 100);
  });

  test("days before tracking began aren't flagged", () => {
    const day = (d: string) => stats.health.find((row) => row.day === d)!;
    assert.deepEqual([day("2026-10-10").broken, day("2026-10-10").beforeTracking], [false, true], "a step, no events, but before tracking");
    assert.equal(day("2026-10-17").broken, false, "the day tracking began, with a partial heartbeat count");
    assert.equal(day("2026-10-18").broken, false);
  });
});

describe("per-code rows can't be subtracted to find one person", () => {
  const user = (id: string, code: string | null, day: string) => ({ id, createdAt: at(day), inviteCodeId: code, streakDays: 0 });
  const camp = ["p1", "p2", "p3", "p4", "p5"].map((id) => user(id, "camp", "2026-09-29"));
  const codes = [
    { id: "camp", note: "Autumn starters", createdAt: at("2026-09-28") },
    { id: "mum", note: "for Mum", createdAt: at("2026-09-28") },
    { id: "sam", note: "for Sam", createdAt: at("2026-09-28") },
  ];
  const base = { ...FIXTURE, codes, practice: [], stepFinishes: [], appOpened: [], frontVisitors: [], inviteOpens: [] };

  test("the reviewer's case: the owner, a 5-signup campaign and one single-use code — no code row in either window", () => {
    const stats = computeStats({ ...base, users: [user("owner", null, "2026-08-20"), ...camp, user("mum1", "mum", "2026-09-29")] });
    for (const window of stats.windows) {
      assert.equal(window.codes.length, 1, window.title);
      assert.match(window.codes[0].label, /^Everyone else/);
    }
    // Last 30 days: the campaign and Mum (6); all time: and the owner (7). Both pools are the whole window.
    assert.equal(stats.windows[0].codes[0].signedUp, 6);
    assert.equal(stats.windows[1].codes[0].signedUp, 7);
    assert.ok(!/for Mum|for Sam|Autumn/.test(JSON.stringify(stats.windows)), "no code's note appears");
  });

  test("with the family's earlier signups, the campaign shows all time — but not in the last 30 days", () => {
    const family = ["f1", "f2", "f3", "f4", "f5", "f6"].map((id) => user(id, null, "2026-08-10"));
    const stats = computeStats({ ...base, users: [...family, ...camp, user("mum1", "mum", "2026-09-29")] });
    const [last30, allTime] = stats.windows;
    // Last 30 days: campaign 5 + Mum 1 → one person left over: the campaign is pooled.
    assert.deepEqual(last30.codes.map((row) => [row.label, row.signedUp]), [["Everyone else: 2 smaller codes", 6]]);
    // All time: six family members and Mum left over: the campaign may show.
    assert.deepEqual(allTime.codes.map((row) => [row.label, row.signedUp]), [
      ["Autumn starters", 5],
      ["Everyone else: 1 smaller code, and learners who joined without one", 7],
    ]);
  });

  test("a code gets its own row at five signups; four single-use codes are pooled", () => {
    const personal = ["s1", "s2", "s3", "s4"].map((id, i) => user(id, `single${i}`, "2026-10-05"));
    const stats = computeStats({
      ...base,
      users: [...camp.map((u) => ({ ...u, createdAt: at("2026-10-05") })), ...personal, user("s5", null, "2026-10-05")],
      codes: [codes[0], ...personal.map((_, i) => ({ id: `single${i}`, note: `for someone ${i}`, createdAt: at("2026-10-02") }))],
    });
    // Four single-use codes and one learner without a code: five left over, so the campaign shows.
    assert.deepEqual(stats.windows[0].codes.map((row) => [row.label, row.signedUp]), [
      ["Autumn starters", 5],
      ["Everyone else: 4 smaller codes, and learners who joined without one", 5],
    ]);
    assert.ok(!JSON.stringify(stats.windows).includes("for someone"), "no personal invite's note is shown");
  });

  test("a cohort of five shows its weekly shares", () => {
    const cohort = ["w1", "w2", "w3", "w4", "w5"].map((id) => user(id, "camp", "2026-10-05"));
    const stats = computeStats({
      ...base,
      users: cohort,
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

/**
 * Any two aggregates on the page where one group of people contains the other
 * must differ by 0 or at least five people, or subtracting them describes
 * someone. What people did after signing up (activated, week 2) is shown in
 * one window only, all time, where the rows split the total into parts of 0
 * or five or more.
 */
function assertNoNestedLeak(stats: ReturnType<typeof computeStats>) {
  const [last30, allTime] = stats.windows;
  assert.deepEqual(
    last30.funnel.map((stage) => stage.name),
    ["Front-page visitors (one per device per day)", "Invite pages opened", "Signed up"],
    "the 30-day funnel stops at signups",
  );
  for (const row of last30.codes) assert.ok(!("activated" in row) && !("weekTwo" in row), `30-day row "${row.label}" shows only opens and signups`);
  const total = allTime.funnel[2].count;
  for (const row of allTime.codes) {
    if (row.signedUp === "<5") continue;
    const rest = total - row.signedUp;
    assert.ok(rest === 0 || rest >= SMALL, `all time: the total minus "${row.label}" is ${rest} people`);
  }
}

describe("the reviewer's cases: no two nested aggregates single anyone out (#117 re-check)", () => {
  const user = (id: string, code: string | null, day: string) => ({ id, createdAt: at(day), inviteCodeId: code, streakDays: 0 });
  const codes = [
    { id: "camp", note: "Autumn starters", createdAt: at("2026-09-28") },
    { id: "mum", note: "for Mum", createdAt: at("2026-09-28") },
  ];
  const base = { ...FIXTURE, codes, stepFinishes: [], appOpened: [], frontVisitors: [], inviteOpens: [] };
  /** Practised on the signup day (activated) and, for some, on day 7 (week 2). */
  const practised = (ids: string[], signup: string, weekTwo: string[]) => [
    ...ids.map((userId) => ({ userId, day: signup, steps: 1 })),
    ...weekTwo.map((userId) => ({ userId, day: utcDay(new Date(Date.parse(`${signup}T00:00:00Z`) + 7 * 24 * 3600 * 1000)), steps: 1 })),
  ];
  const camp = ["p1", "p2", "p3", "p4", "p5"].map((id) => user(id, "camp", "2026-09-29"));

  test("A: six earlier family members, then the campaign and Mum — the 30-day pool minus the campaign row was Mum", () => {
    const family = ["f1", "f2", "f3", "f4", "f5", "f6"].map((id) => user(id, null, "2026-08-10"));
    const stats = computeStats({
      ...base,
      users: [...family, ...camp, user("mum1", "mum", "2026-09-29")],
      practice: [...practised(["p1", "p2", "p3", "p4", "mum1"], "2026-09-29", ["p1", "p2", "p3", "mum1"]), ...practised(["f1"], "2026-08-10", [])],
    });
    // Before: last 30 days "Everyone else (2 smaller codes): 6 · 5 · 4" and all time "Autumn starters: 5 · 4 · 3" → Mum 1 · 1.
    assert.deepEqual(stats.windows[0].codes, [{ label: "Everyone else: 2 smaller codes", made: null, opened: 0, signedUp: 6 }]);
    assert.deepEqual(stats.windows[1].codes.map((row) => [row.label, row.signedUp, row.activated, row.weekTwo]), [
      ["Autumn starters", 5, 4, 3],
      ["Everyone else: 1 smaller code, and learners who joined without one", 7, 2, 1],
    ]);
    assertNoNestedLeak(stats);
  });

  test("B: the owner and Gran long ago, the campaign recently — the all-time funnel minus the 30-day one was them", () => {
    const stats = computeStats({
      ...base,
      users: [user("owner", null, "2026-08-20"), user("gran", null, "2026-08-20"), ...camp],
      practice: [...practised(["owner", "gran"], "2026-08-20", ["owner"]), ...practised(["p1", "p2", "p3", "p4"], "2026-09-29", ["p1", "p2", "p3"])],
    });
    // Before: all time 7 · 6 · 4, last 30 days 5 · 4 · 3 → the owner and Gran 2 · 2 · 1.
    assert.deepEqual(counts(stats.windows[1].funnel).slice(2).map(([count]) => count), [7, 6, 4]);
    assert.equal(stats.windows[0].funnel.length, 3);
    assertNoNestedLeak(stats);
  });

  test("the hand-computed fixture holds to the same rule", () => {
    assertNoNestedLeak(computeStats(FIXTURE));
  });
});
