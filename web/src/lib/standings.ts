/**
 * Leaderboard arithmetic: week boundaries, live streaks, and ranking.
 *
 * Pure, so it is unit-tested; lib/leaderboard.ts does the database reads.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing `now`. Boards reset then. */
export function weekStart(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // getUTCDay: Sunday 0 … Saturday 6. Days since Monday: (day + 6) % 7.
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY_MS);
}

function dayIndex(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
}

/**
 * The streak as it stands today. Langue never takes a streak away: a learner
 * who misses days keeps it, and picks it up again when they come back (see
 * nextStreak). Losing a long streak is as likely to make someone give up as
 * to bring them back — the reminders nudge, the streak waits.
 */
export function liveStreak(streakDays: number, _lastActiveAt: Date, _now: Date): number {
  return streakDays;
}

/**
 * Recompute the streak from the previous activity date.
 *
 * Same day: unchanged. A new day: +1 — whether it's the next day or the
 * first day back after a break. Langue never resets a streak; reminders
 * nudge people back before it "slips", but it is always there when they
 * return (lib/standings.ts: liveStreak).
 */
export function nextStreak(previousActive: Date, currentStreak: number, now: Date): number {
  const gap = dayIndex(now) - dayIndex(previousActive);
  if (gap <= 0) return Math.max(1, currentStreak);
  return currentStreak + 1;
}

/**
 * Days since the learner last practised, by calendar day: 0 today, 1 for
 * yesterday. Two or more means the streak is waiting for them.
 */
export function daysAway(lastActiveAt: Date, now: Date): number {
  return Math.max(0, dayIndex(now) - dayIndex(lastActiveAt));
}

export interface Standing {
  userId: string;
  displayName: string;
  weekPoints: number;
  totalPoints: number;
  streak: number;
  /** Highest finished level per language: ["IT A1", "FR A2"]. */
  badges?: string[];
}

const LANGUAGE_CODES: Record<string, string> = { italian: "IT", spanish: "ES", french: "FR", portuguese: "PT" };
const LEVEL_ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];

/**
 * Badges from a learner's finished-level achievements ("level:italian:a1"):
 * the highest level finished in each language, languages in a fixed order.
 */
export function levelBadges(achievements: string[]): string[] {
  const best = new Map<string, number>();
  for (const name of achievements) {
    const [kind, language, level] = name.split(":");
    const rank = LEVEL_ORDER.indexOf(level);
    if (kind !== "level" || !language || rank === -1) continue;
    best.set(language, Math.max(best.get(language) ?? -1, rank));
  }
  return [...best.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([language, rank]) => `${LANGUAGE_CODES[language] ?? language.slice(0, 2).toUpperCase()} ${LEVEL_ORDER[rank].toUpperCase()}`);
}

export type BoardPeriod = "week" | "all";

export interface RankedStanding extends Standing {
  rank: number;
}

/**
 * Sort by the period's points, highest first, and assign ranks. Ties share a
 * rank (1, 1, 3) — two kids on the same score are both first, not first and
 * second by alphabet. Within a tie, names sort alphabetically for a stable
 * order.
 */
export function rankStandings(rows: Standing[], period: BoardPeriod): RankedStanding[] {
  const score = (row: Standing) => (period === "week" ? row.weekPoints : row.totalPoints);
  const sorted = [...rows].sort(
    (a, b) => score(b) - score(a) || a.displayName.localeCompare(b.displayName),
  );

  return sorted.map((row, index) => {
    const firstWithScore = sorted.findIndex((other) => score(other) === score(row));
    return { ...row, rank: (firstWithScore === -1 ? index : firstWithScore) + 1 };
  });
}
