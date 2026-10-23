/**
 * The usage dashboard's numbers (#109): the funnel, retention, engagement and
 * tracking health, from rows the loader (stats-data.ts) reads. Pure, so every
 * definition here is tested against hand-computed fixtures.
 *
 * Days are UTC, as everywhere else in Langue. "Practised" means finishing a
 * step, a challenge or any activity that day (ActivityLog).
 *
 * Small numbers never describe a person, alone or subtracted from another:
 * - what people did after signing up (activated, week 2) is shown all time
 *   only, so no two windows can be subtracted to find someone; the last 30
 *   days show visits, invite opens and signups;
 * - a code gets its own row in a window only when everyone else who signed up
 *   in that window (smaller codes and learners with no code) is 0 or at least
 *   SMALL people, so the app-wide totals minus the shown rows can't isolate
 *   anyone; otherwise it is pooled too;
 * - a breakdown, or a retention rate, over fewer than SMALL people reads "<5".
 *
 * Learners and practice go back to launch; events start when tracking did. A
 * ratio that mixes the two (invite pages opened → signups, steps started →
 * finished) counts only from the first event, and says so.
 */

export const SMALL = 5;
/** The cohort table's weeks: 0 and 1 are activated and week 2, which the funnel shows all time only. */
export const COHORT_FIRST_WEEK = 2;
export const COHORT_LAST_WEEK = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** "Opened but didn't practise": no step finished within this long of opening the app. */
export const PRACTISE_WITHIN_MS = 3 * HOUR_MS;

type User = { id: string; createdAt: Date; inviteCodeId: string | null; streakDays: number };

export interface StatsInput {
  now: Date;
  /** The first event ever recorded: when tracking began. Null before it has. */
  trackingSince: Date | null;
  users: User[];
  codes: { id: string; note: string | null; createdAt: Date }[];
  /** One row per learner per day with any practice: finished steps (and challenges) that day. */
  practice: { userId: string; day: string; steps: number }[];
  /** Finished steps and challenges over the last 30 days, with their times. */
  stepFinishes: { userId: string; at: Date }[];
  /** Front-page visitors per day: page views of "/" that were a device's first that day. */
  frontVisitors: { day: string; visitors: number }[];
  /** invite.opened per code: all time and in the last 30 days. */
  inviteOpens: { inviteCodeId: string; total: number; recent: number }[];
  /** app.opened over the last 30 days: who, and when. */
  appOpened: { userId: string; at: Date }[];
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

/** A number for a breakdown: the number, or "<5" when it would describe fewer than five people. */
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

function journey(users: User[], practiceDays: Map<string, Map<string, number>>, today: string): Journey {
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
  /** Share of the stage before that got here, of those who've had time to; null for the first stage or before tracking. */
  conversion: number | null;
  /** People who might still get here (too recent to tell). */
  pending?: number;
  /** When the conversion only counts part of the stage: "since tracking began on 2026-10-19". */
  note?: string;
}

export interface CodeRow {
  label: string;
  made: string | null;
  /** Invite pages opened, since tracking began. */
  opened: Shown;
  signedUp: Shown;
  /** All time only. */
  activated?: Shown;
  weekTwo?: Shown;
}

export interface Window {
  title: string;
  funnel: FunnelStage[];
  codes: CodeRow[];
}

export interface Stats {
  /** The day tracking began, or null before any event. */
  trackingSince: string | null;
  windows: Window[];
  retention: { day: 1 | 7 | 30; share: Shown | null; n: number }[];
  /** Per signup week: who practised in each week `n` after signing up, from COHORT_FIRST_WEEK. */
  cohorts: { week: string; size: Shown; weeks: { n: number; share: Shown }[] }[];
  engagement: {
    activeToday: number;
    dailyAverage: number;
    weekly: number;
    monthly: number;
    stickiness: number | null;
    openedNotPractised: number | null;
    /** Opens at least PRACTISE_WITHIN_MS old: the ones that can be judged. */
    appOpens: number;
    /** Opens newer than that: too soon to tell. */
    appOpensPending: number;
    stepsStarted: number;
    /** Steps finished since tracking began (within the 30 days), to compare with started. */
    stepsFinished: number;
    finishedShare: number | null;
    stepsPerActiveDay: number | null;
    streaks: { bucket: string; learners: Shown }[];
    remindersOn: number;
  };
  health: { day: string; events: number; steps: number; heartbeats: number; broken: boolean; beforeTracking: boolean }[];
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

/**
 * The per-code rows for the learners who signed up in a window. A code with
 * five or more of them may have a row, but only while everyone left over
 * (smaller codes and learners with no code) is 0 or at least five: the
 * smallest shown code is pooled until that holds.
 */
function codeRows(
  users: User[],
  codes: StatsInput["codes"],
  opens: Map<string, number>,
  practiceDays: Map<string, Map<string, number>>,
  today: string,
  withJourney: boolean,
): CodeRow[] {
  const members = (codeId: string) => users.filter((user) => user.inviteCodeId === codeId);
  const shownCodes = codes
    .filter((code) => members(code.id).length >= SMALL)
    .sort((a, b) => members(b.id).length - members(a.id).length || a.createdAt.getTime() - b.createdAt.getTime());
  const left = () => users.length - shownCodes.reduce((sum, code) => sum + members(code.id).length, 0);
  while (shownCodes.length > 0 && left() > 0 && left() < SMALL) shownCodes.pop();

  const rows: CodeRow[] = shownCodes
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((code) => {
      const row: CodeRow = { label: code.note || "(no note)", made: utcDay(code.createdAt), opened: opens.get(code.id) ?? 0, signedUp: members(code.id).length };
      if (!withJourney) return row;
      const j = journey(members(code.id), practiceDays, today);
      return { ...row, activated: j.activated, weekTwo: j.weekTwo };
    });

  const shownIds = new Set(shownCodes.map((code) => code.id));
  const pool = users.filter((user) => !user.inviteCodeId || !shownIds.has(user.inviteCodeId));
  const pooledCodes = codes.filter((code) => !shownIds.has(code.id) && (members(code.id).length > 0 || (opens.get(code.id) ?? 0) > 0));
  const withoutCode = pool.some((user) => !user.inviteCodeId);
  if (pool.length > 0 || pooledCodes.length > 0) {
    const opened = pooledCodes.reduce((sum, code) => sum + (opens.get(code.id) ?? 0), 0);
    const label =
      `Everyone else: ${pooledCodes.length} smaller code${pooledCodes.length === 1 ? "" : "s"}` +
      (withoutCode ? ", and learners who joined without one" : "");
    const row: CodeRow = { label, made: null, opened: shown(opened, pool.length), signedUp: shown(pool.length, pool.length) };
    if (withJourney) {
      const j = journey(pool, practiceDays, today);
      Object.assign(row, { activated: shown(j.activated, pool.length), weekTwo: shown(j.weekTwo, pool.length) });
    }
    rows.push(row);
  }
  return rows;
}

export function computeStats(input: StatsInput): Stats {
  const today = utcDay(input.now);
  const since30 = utcDay(new Date(input.now.getTime() - 29 * DAY_MS));
  const in30 = (day: string) => day >= since30 && day <= today;
  const tracking = input.trackingSince;
  const trackingDay = tracking ? utcDay(tracking) : null;
  const sinceTracking = (date: Date) => tracking !== null && date.getTime() >= tracking.getTime();
  const trackingNote = trackingDay ? `since tracking began on ${trackingDay}` : undefined;

  const practiceDays = new Map<string, Map<string, number>>();
  for (const row of input.practice) {
    const days = practiceDays.get(row.userId) ?? new Map<string, number>();
    days.set(row.day, (days.get(row.day) ?? 0) + row.steps);
    practiceDays.set(row.userId, days);
  }

  // The funnel and the per-code rows, over two windows. Only one has what people did after signing up (withJourney):
  // with both, the all-time numbers minus the 30-day ones would describe whoever joined before.
  const window = (title: string, users: User[], visitors: number, opened: number, opensByCode: Map<string, number>, withJourney: boolean): Window => {
    const j = journey(users, practiceDays, today);
    // Invite pages opened → signed up mixes events with signups that may predate them: count signups since tracking began.
    const trackedSignups = users.filter((user) => sinceTracking(user.createdAt)).length;
    const funnel: FunnelStage[] = [
      { name: "Front-page visitors (one per device per day)", count: visitors, conversion: null },
      { name: "Invite pages opened", count: opened, conversion: percent(opened, visitors) },
      {
        name: "Signed up",
        count: j.signedUp,
        conversion: tracking ? percent(trackedSignups, opened) : null,
        note: tracking && trackedSignups < j.signedUp ? `${trackedSignups} of them ${trackingNote}` : undefined,
      },
    ];
    if (withJourney) {
      funnel.push(
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
      );
    }
    return { title, funnel, codes: codeRows(users, input.codes, opensByCode, practiceDays, today, withJourney) };
  };
  const windows = [
    window(
      "Last 30 days",
      input.users.filter((user) => in30(utcDay(user.createdAt))),
      input.frontVisitors.filter((row) => in30(row.day)).reduce((sum, row) => sum + row.visitors, 0),
      input.inviteOpens.reduce((sum, row) => sum + row.recent, 0),
      new Map(input.inviteOpens.map((row) => [row.inviteCodeId, row.recent])),
      false,
    ),
    window(
      "All time",
      input.users,
      input.frontVisitors.reduce((sum, row) => sum + row.visitors, 0),
      input.inviteOpens.reduce((sum, row) => sum + row.total, 0),
      new Map(input.inviteOpens.map((row) => [row.inviteCodeId, row.total])),
      true,
    ),
  ];

  // Retention: of everyone who signed up at least k days ago, who practised on day k. Under five people: "<5".
  const retention = ([1, 7, 30] as const).map((k) => {
    const old = input.users.filter((user) => daysBetween(utcDay(user.createdAt), today) >= k);
    const back = old.filter((user) => practiceDays.get(user.id)?.has(utcDay(new Date(Date.parse(`${utcDay(user.createdAt)}T00:00:00Z`) + k * DAY_MS))));
    const share = percent(back.length, old.length);
    return { day: k, share: share === null ? null : shown(share, old.length), n: old.length };
  });

  // Weekly signup cohorts × weeks since signup: who practised in that week. From week 2: weeks 0 and 1 are activated
  // and week 2 under another name, shown all time only, and per signup week they could be subtracted from those.
  const cohortsByWeek = new Map<string, User[]>();
  for (const user of input.users) {
    const week = weekOf(utcDay(user.createdAt));
    cohortsByWeek.set(week, [...(cohortsByWeek.get(week) ?? []), user]);
  }
  const cohorts = [...cohortsByWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 8)
    .map(([week, members]) => {
      const reached = Math.floor(daysBetween(week, today) / 7);
      const weeks = Array.from({ length: Math.max(0, Math.min(COHORT_LAST_WEEK, reached) - COHORT_FIRST_WEEK + 1) }, (_, i) => {
        const w = COHORT_FIRST_WEEK + i;
        const active = members.filter((user) => {
          const signup = utcDay(user.createdAt);
          return [...(practiceDays.get(user.id)?.keys() ?? [])].some((day) => {
            const offset = daysBetween(signup, day);
            return offset >= w * 7 && offset < (w + 1) * 7;
          });
        }).length;
        return { n: w, share: members.length < SMALL ? ("<5" as const) : (percent(active, members.length) ?? 0) };
      });
      return { week, size: shown(members.length, members.length), weeks };
    });

  // Engagement, over the last 30 days. Active learners come from practice alone, so keep their full history.
  const recentPractice = input.practice.filter((row) => in30(row.day));
  const activeOn = (day: string) => new Set(recentPractice.filter((row) => row.day === day).map((row) => row.userId)).size;
  const learnersSince = (since: string) => new Set(recentPractice.filter((row) => row.day >= since).map((row) => row.userId)).size;
  const days30 = Array.from({ length: 30 }, (_, i) => utcDay(new Date(input.now.getTime() - i * DAY_MS)));
  const dailyAverage = Math.round((days30.reduce((sum, day) => sum + activeOn(day), 0) / 30) * 10) / 10;
  const monthly = learnersSince(since30);
  // Opened the app, and no step finished within three hours: no day boundary to split a session.
  // An open newer than that is pending: it may yet be practised.
  const recentOpens = input.appOpened.filter((open) => in30(utcDay(open.at)));
  const opens = recentOpens.filter((open) => input.now.getTime() - open.at.getTime() >= PRACTISE_WITHIN_MS);
  const notPractised = opens.filter(
    (open) =>
      !input.stepFinishes.some(
        (step) => step.userId === open.userId && step.at.getTime() >= open.at.getTime() && step.at.getTime() < open.at.getTime() + PRACTISE_WITHIN_MS,
      ),
  ).length;
  // Steps started are events: compare them with steps finished since tracking began.
  const finishedTracked = input.stepFinishes.filter((step) => in30(utcDay(step.at)) && sinceTracking(step.at)).length;
  const stepsFinished = recentPractice.reduce((sum, row) => sum + row.steps, 0);
  const activeDays = new Set(recentPractice.filter((row) => row.steps > 0).map((row) => `${row.userId} ${row.day}`)).size;
  const streaks = STREAKS.map(([bucket, low, high]) => {
    const learners = input.users.filter((user) => user.streakDays >= low && user.streakDays <= high).length;
    return { bucket, learners: shown(learners, learners) };
  });

  // Health: events next to the steps they should accompany, and the hourly heartbeat — from the day tracking began.
  const stepsByDay = new Map<string, number>();
  for (const row of input.practice) stepsByDay.set(row.day, (stepsByDay.get(row.day) ?? 0) + row.steps);
  const eventsByDay = new Map(input.eventDays.map((row) => [row.day, row]));
  const health = Array.from({ length: 14 }, (_, i) => utcDay(new Date(input.now.getTime() - i * DAY_MS))).map((day) => {
    const events = eventsByDay.get(day)?.events ?? 0;
    const heartbeats = eventsByDay.get(day)?.heartbeats ?? 0;
    const steps = stepsByDay.get(day) ?? 0;
    const beforeTracking = trackingDay === null || day < trackingDay;
    // Steps finished but no events, or a whole past day without a heartbeat: tracking may be broken.
    const broken = !beforeTracking && ((steps > 0 && events === 0) || (day < today && day > trackingDay! && heartbeats === 0));
    return { day, events, steps, heartbeats, broken, beforeTracking };
  });

  return {
    trackingSince: trackingDay,
    windows,
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
      appOpensPending: recentOpens.length - opens.length,
      stepsStarted: input.stepsStarted,
      stepsFinished: finishedTracked,
      finishedShare: tracking ? percent(finishedTracked, input.stepsStarted) : null,
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
