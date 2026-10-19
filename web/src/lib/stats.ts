/**
 * The usage dashboard's numbers (#109): the funnel, retention, engagement and
 * tracking health, from rows the loader (stats-data.ts) reads. Pure, so every
 * definition here is tested against a hand-computed fixture.
 *
 * Days are UTC, as everywhere else in Langue. "Practised" means finishing a
 * step, a challenge or any activity that day (ActivityLog). Breakdowns with
 * fewer than SMALL learners are never shown as numbers: they read "<5" or are
 * pooled, so no row describes one person.
 */

export const SMALL = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatsInput {
  now: Date;
  users: { id: string; createdAt: Date; inviteCodeId: string | null; streakDays: number }[];
  codes: { id: string; note: string | null; createdAt: Date }[];
  /** One row per learner per day with any practice: finished steps (and challenges) and all activities. */
  practice: { userId: string; day: string; steps: number }[];
  /** Front-page visitors per day: distinct daily visitor hashes on page.viewed "/". */
  frontVisitors: { day: string; visitors: number }[];
  /** invite.opened per code: all time and in the last 30 days. */
  inviteOpens: { inviteCodeId: string; total: number; recent: number }[];
  /** Learners who opened the app, per day, in the last 30 days (app.opened). */
  appOpened: { userId: string; day: string }[];
  /** step.started in the last 30 days. */
  stepsStarted: number;
  /** Events, and heartbeats among them, per day over the last 14 days. */
  eventDays: { day: string; events: number; heartbeats: number }[];
  /** Learners with streak reminders on. */
  remindersOn: number;
}

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
/** Whole days from `from` to `to`. */
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/** A count for a breakdown: the number, or "<5" when it would describe fewer than five people. */
export type Shown = number | "<5";
export function shown(value: number, people: number): Shown {
  return people < SMALL ? "<5" : value;
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

interface Journey {
  signedUp: number;
  /** Finished a first step within 7 days of signing up. */
  activated: number;
  /** Signed up under 7 days ago and not activated yet: could still be. */
  activationPending: number;
  /** Activated, and practised on any of days 7–13 after signing up. */
  weekTwo: number;
  /** Activated, signed up under 14 days ago, not back in week 2 yet: could still be. */
  weekTwoPending: number;
}

function journey(users: StatsInput["users"], practiceDays: Map<string, Map<string, number>>, today: string): Journey {
  const result: Journey = { signedUp: users.length, activated: 0, activationPending: 0, weekTwo: 0, weekTwoPending: 0 };
  for (const user of users) {
    const signup = utcDay(user.createdAt);
    const age = daysBetween(signup, today);
    const days = [...(practiceDays.get(user.id) ?? new Map())].map(([day, steps]) => ({ offset: daysBetween(signup, day), steps }));
    if (!days.some(({ offset, steps }) => steps > 0 && offset >= 0 && offset < 7)) {
      if (age < 7) result.activationPending++;
      continue;
    }
    result.activated++;
    if (days.some(({ offset }) => offset >= 7 && offset <= 13)) result.weekTwo++;
    else if (age < 14) result.weekTwoPending++;
  }
  return result;
}

export interface FunnelStage {
  name: string;
  count: number;
  /** Share of the stage before that got here, of those who've had time to; null for the first stage. */
  conversion: number | null;
  /** People who might still get here (too recent to tell). */
  pending?: number;
}

function funnel(visitors: number, opened: number, j: Journey): FunnelStage[] {
  return [
    { name: "Front-page visitors (one per visitor per day)", count: visitors, conversion: null },
    { name: "Invite pages opened", count: opened, conversion: percent(opened, visitors) },
    { name: "Signed up", count: j.signedUp, conversion: percent(j.signedUp, opened) },
    {
      name: "Activated (a first step within 7 days)",
      count: j.activated,
      conversion: percent(j.activated, j.signedUp - j.activationPending),
      pending: j.activationPending,
    },
    {
      name: "Week-2 active (practised on days 7–13)",
      count: j.weekTwo,
      conversion: percent(j.weekTwo, j.activated - j.weekTwoPending),
      pending: j.weekTwoPending,
    },
  ];
}

export interface CodeRow {
  label: string;
  made: string | null;
  opened: Shown;
  signedUp: Shown;
  activated: Shown;
  weekTwo: Shown;
}

export interface Stats {
  funnel30: FunnelStage[];
  funnelAll: FunnelStage[];
  codes: CodeRow[];
  retention: { day: 1 | 7 | 30; share: number | null; n: number }[];
  cohorts: { week: string; size: Shown; weeks: (Shown | null)[] }[];
  engagement: {
    activeToday: number;
    dailyAverage: number;
    weekly: number;
    monthly: number;
    stickiness: number | null;
    openedNotPractised: number | null;
    appOpens: number;
    stepsStarted: number;
    stepsFinished: number;
    finishedShare: number | null;
    stepsPerActiveDay: number | null;
    streaks: { bucket: string; learners: Shown }[];
    remindersOn: number;
  };
  health: { day: string; events: number; steps: number; heartbeats: number; broken: boolean }[];
}

const STREAKS: [string, number, number][] = [
  ["0 days", 0, 0],
  ["1–2", 1, 2],
  ["3–6", 3, 6],
  ["7–13", 7, 13],
  ["14–29", 14, 29],
  ["30+", 30, Infinity],
];

/** Monday of the UTC week a day falls in. */
function weekOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return utcDay(new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS));
}

export function computeStats(input: StatsInput): Stats {
  const today = utcDay(input.now);
  const since30 = utcDay(new Date(input.now.getTime() - 29 * DAY_MS));
  const in30 = (day: string) => day >= since30 && day <= today;

  const practiceDays = new Map<string, Map<string, number>>();
  for (const row of input.practice) {
    const days = practiceDays.get(row.userId) ?? new Map<string, number>();
    days.set(row.day, (days.get(row.day) ?? 0) + row.steps);
    practiceDays.set(row.userId, days);
  }

  // Funnel: the last 30 days and all time.
  const recentUsers = input.users.filter((user) => in30(utcDay(user.createdAt)));
  const visitors30 = input.frontVisitors.filter((row) => in30(row.day)).reduce((sum, row) => sum + row.visitors, 0);
  const visitorsAll = input.frontVisitors.reduce((sum, row) => sum + row.visitors, 0);
  const opened30 = input.inviteOpens.reduce((sum, row) => sum + row.recent, 0);
  const openedAll = input.inviteOpens.reduce((sum, row) => sum + row.total, 0);
  const funnel30 = funnel(visitors30, opened30, journey(recentUsers, practiceDays, today));
  const funnelAll = funnel(visitorsAll, openedAll, journey(input.users, practiceDays, today));

  // Per code: its own row at five or more signups; every smaller code pooled.
  const opensByCode = new Map(input.inviteOpens.map((row) => [row.inviteCodeId, row.total]));
  const codes: CodeRow[] = [];
  const pooled = { codes: 0, opened: 0, users: [] as StatsInput["users"] };
  for (const code of [...input.codes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const members = input.users.filter((user) => user.inviteCodeId === code.id);
    const opened = opensByCode.get(code.id) ?? 0;
    if (members.length >= SMALL) {
      const j = journey(members, practiceDays, today);
      codes.push({ label: code.note || "(no note)", made: utcDay(code.createdAt), opened, signedUp: j.signedUp, activated: j.activated, weekTwo: j.weekTwo });
    } else {
      pooled.codes++;
      pooled.opened += opened;
      pooled.users.push(...members);
    }
  }
  if (pooled.codes > 0) {
    const j = journey(pooled.users, practiceDays, today);
    const people = pooled.users.length;
    codes.push({
      label: `Personal and small invites (${pooled.codes} code${pooled.codes === 1 ? "" : "s"})`,
      made: null,
      opened: shown(pooled.opened, people),
      signedUp: shown(people, people),
      activated: shown(j.activated, people),
      weekTwo: shown(j.weekTwo, people),
    });
  }

  // Retention: of everyone who signed up at least k days ago, who practised on day k.
  const retention = ([1, 7, 30] as const).map((k) => {
    const old = input.users.filter((user) => daysBetween(utcDay(user.createdAt), today) >= k);
    const back = old.filter((user) => practiceDays.get(user.id)?.has(utcDay(new Date(Date.parse(`${utcDay(user.createdAt)}T00:00:00Z`) + k * DAY_MS))));
    return { day: k, share: percent(back.length, old.length), n: old.length };
  });

  // Weekly signup cohorts × weeks since signup: who practised in that week.
  const cohortsByWeek = new Map<string, StatsInput["users"]>();
  for (const user of input.users) {
    const week = weekOf(utcDay(user.createdAt));
    cohortsByWeek.set(week, [...(cohortsByWeek.get(week) ?? []), user]);
  }
  const cohorts = [...cohortsByWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 8)
    .map(([week, members]) => {
      const reached = Math.floor(daysBetween(week, today) / 7);
      const weeks = Array.from({ length: Math.min(8, reached + 1) }, (_, w) => {
        const active = members.filter((user) => {
          const signup = utcDay(user.createdAt);
          return [...(practiceDays.get(user.id)?.keys() ?? [])].some((day) => {
            const offset = daysBetween(signup, day);
            return offset >= w * 7 && offset < (w + 1) * 7;
          });
        }).length;
        return members.length < SMALL ? ("<5" as const) : (percent(active, members.length) ?? 0);
      });
      return { week, size: shown(members.length, members.length), weeks };
    });

  // Engagement, over the last 30 days.
  const recentPractice = input.practice.filter((row) => in30(row.day));
  const activeOn = (day: string) => new Set(recentPractice.filter((row) => row.day === day).map((row) => row.userId)).size;
  const learnersSince = (since: string) => new Set(recentPractice.filter((row) => row.day >= since).map((row) => row.userId)).size;
  const days30 = Array.from({ length: 30 }, (_, i) => utcDay(new Date(input.now.getTime() - i * DAY_MS)));
  const dailyAverage = Math.round((days30.reduce((sum, day) => sum + activeOn(day), 0) / 30) * 10) / 10;
  const monthly = learnersSince(since30);
  const practisedOn = new Set(recentPractice.map((row) => `${row.userId} ${row.day}`));
  const opens = input.appOpened.filter((row) => in30(row.day));
  const notPractised = opens.filter((row) => !practisedOn.has(`${row.userId} ${row.day}`)).length;
  const stepsFinished = recentPractice.reduce((sum, row) => sum + row.steps, 0);
  const activeDays = new Set(recentPractice.filter((row) => row.steps > 0).map((row) => `${row.userId} ${row.day}`)).size;
  const streaks = STREAKS.map(([bucket, low, high]) => {
    const learners = input.users.filter((user) => user.streakDays >= low && user.streakDays <= high).length;
    return { bucket, learners: shown(learners, learners) };
  });

  // Health: events next to the steps they should accompany, and the hourly heartbeat.
  const stepsByDay = new Map<string, number>();
  for (const row of input.practice) stepsByDay.set(row.day, (stepsByDay.get(row.day) ?? 0) + row.steps);
  const eventsByDay = new Map(input.eventDays.map((row) => [row.day, row]));
  const health = Array.from({ length: 14 }, (_, i) => utcDay(new Date(input.now.getTime() - i * DAY_MS))).map((day) => {
    const events = eventsByDay.get(day)?.events ?? 0;
    const heartbeats = eventsByDay.get(day)?.heartbeats ?? 0;
    const steps = stepsByDay.get(day) ?? 0;
    // Steps finished but no events, or a whole past day without a heartbeat: tracking may be broken.
    return { day, events, steps, heartbeats, broken: (steps > 0 && events === 0) || (day < today && heartbeats === 0) };
  });

  return {
    funnel30,
    funnelAll,
    codes,
    retention,
    cohorts,
    engagement: {
      activeToday: activeOn(today),
      dailyAverage,
      weekly: learnersSince(utcDay(new Date(input.now.getTime() - 6 * DAY_MS))),
      monthly,
      stickiness: monthly > 0 ? Math.round((dailyAverage / monthly) * 100) : null,
      openedNotPractised: percent(notPractised, opens.length),
      appOpens: opens.length,
      stepsStarted: input.stepsStarted,
      stepsFinished,
      finishedShare: percent(stepsFinished, input.stepsStarted),
      stepsPerActiveDay: activeDays > 0 ? Math.round((stepsFinished / activeDays) * 10) / 10 : null,
      streaks,
      remindersOn: input.remindersOn,
    },
    health,
  };
}

/** The tripwires written beside the numbers: when one trips, look at what it names. */
export const TRIPWIRES = {
  activated: { below: 60, look: "the first-run experience" },
  weekTwo: { below: 40, look: "onboarding and reminders" },
  openedNotPractised: { above: 30, look: "friction on the home screen" },
  finishedShare: { below: 80, look: "steps that are too long or too hard" },
  stickiness: { below: 20, look: "what brings people back" },
} as const;
