import type { BoardPeriod, RankedStanding } from "@/lib/standings";

/**
 * A leaderboard table: weekly points, total points and day streak side by
 * side, ranked by whichever points column `period` names (that column is
 * highlighted). Server component; compact on the home screen, where total
 * points are left out — the header already shows yours.
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
  const cell = "px-2 py-1.5";
  const head = `${cell} font-normal`;
  const ranked = "text-[var(--crt-accent)]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]">
            <th className={`${head} w-10`}>#</th>
            <th className={head}>Learner</th>
            <th className={`${head} text-right ${period === "week" ? ranked : ""}`}>Weekly points</th>
            {compact ? null : (
              <th className={`${head} text-right ${period === "all" ? ranked : ""}`}>Total points</th>
            )}
            <th className={`${head} text-right`}>Day streak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const you = row.userId === viewerId;
            const strong = "text-[var(--crt-fg-bright)]";
            return (
              <tr
                key={row.userId}
                className={`border-t border-[var(--crt-rule)] ${you ? "bg-[var(--crt-selection)]" : ""}`}
              >
                <td className={`${cell} ${row.rank === 1 ? ranked : "text-[var(--crt-fg-dim)]"}`}>
                  {row.rank === 1 ? "★" : row.rank}
                </td>
                <td className={`${cell} ${strong}`}>
                  {row.displayName}
                  {you ? <span className="ml-2 text-xs text-[var(--crt-fg-dim)]">you</span> : null}
                </td>
                <td className={`${cell} text-right tabular-nums ${period === "week" ? strong : ""}`}>
                  {row.weekPoints.toLocaleString()}
                </td>
                {compact ? null : (
                  <td className={`${cell} text-right tabular-nums ${period === "all" ? strong : ""}`}>
                    {row.totalPoints.toLocaleString()}
                  </td>
                )}
                <td className={`${cell} text-right tabular-nums`}>{row.streak}d</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
