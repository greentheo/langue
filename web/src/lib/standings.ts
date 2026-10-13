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
 * The streak as it stands today.
 *
 * The stored streak only changes when the learner practises, so someone who
 * stopped a week ago would still show their old streak. A streak is alive if
 * they practised today or yesterday; otherwise it is zero.
 */
export function liveStreak(streakDays: number, lastActiveAt: Date, now: Date): number {
  return dayIndex(now) - dayIndex(lastActiveAt) <= 1 ? streakDays : 0;
}

export interface Standing {
  userId: string;
  displayName: string;
  weekPoints: number;
  totalPoints: number;
  streak: number;
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
