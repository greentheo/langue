import type { BoardPeriod, RankedStanding } from "@/lib/standings";

/**
 * A leaderboard table. Server component; used full-size on the leaderboard
 * page and compact (name and points only) on the home screen.
 */
export function StandingsTable({
  rows,
  period,
  viewerId,
  compact = false,
}: {
  rows: RankedStanding[];
  period: BoardPeriod;
  viewerId: string;
  compact?: boolean;
}) {
  const pointsLabel = period === "week" ? "This week" : "All time";
  const cell = "px-2 py-1.5";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]">
            <th className={`${cell} w-10 font-normal`}>#</th>
            <th className={`${cell} font-normal`}>Learner</th>
            <th className={`${cell} text-right font-normal`}>{pointsLabel}</th>
            {compact ? null : (
              <>
                <th className={`${cell} text-right font-normal`}>Streak</th>
                <th className={`${cell} text-right font-normal`}>Lessons</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const you = row.userId === viewerId;
            const points = period === "week" ? row.weekPoints : row.totalPoints;
            return (
              <tr
                key={row.userId}
                className={`border-t border-[var(--crt-rule)] ${you ? "bg-[var(--crt-selection)]" : ""}`}
              >
                <td className={`${cell} ${row.rank === 1 ? "text-[var(--crt-accent)]" : "text-[var(--crt-fg-dim)]"}`}>
                  {row.rank === 1 ? "★" : row.rank}
                </td>
                <td className={`${cell} text-[var(--crt-fg-bright)]`}>
                  {row.displayName}
                  {you ? <span className="ml-2 text-xs text-[var(--crt-fg-dim)]">you</span> : null}
                </td>
                <td className={`${cell} text-right tabular-nums text-[var(--crt-fg-bright)]`}>
                  {points.toLocaleString()}
                </td>
                {compact ? null : (
                  <>
                    <td className={`${cell} text-right tabular-nums`}>{row.streak}d</td>
                    <td className={`${cell} text-right tabular-nums`}>{row.lessonsCompleted}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
