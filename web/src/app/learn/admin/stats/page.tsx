import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { Panel } from "@/components/crt";
import { computeStats, TRIPWIRES, type FunnelStage, type Shown } from "@/lib/stats";
import { loadStats } from "@/lib/stats-data";

export const metadata = { title: "Usage — LANGUE" };

/**
 * The usage dashboard (#109): the signup funnel, retention, engagement and
 * whether tracking is healthy. Admins only; anyone else gets a 404. Totals for
 * the whole app are always shown; every breakdown of fewer than five learners
 * reads "<5" or is pooled, and there is no per-person view. Each headline
 * number has its tripwire beside it: what to look at when it trips.
 */
export default async function StatsPage() {
  const user = await verifySession();
  if (!user) redirect("/login");
  if (!user.isAdmin) notFound();

  const stats = computeStats(await loadStats());
  const { engagement: e } = stats;
  const activated = stats.funnel30[3];
  const weekTwo = stats.funnel30[4];

  return (
    <div className="space-y-8">
      <div>
        <p className="crt-label">Admin</p>
        <h1 className="mt-1 text-2xl crt-glow">Usage</h1>
        <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
          From Langue&apos;s own records: no third parties. Days are UTC. Breakdowns under five learners read
          &ldquo;&lt;5&rdquo;.
        </p>
      </div>

      <Panel title="Funnel">
        <div className="grid gap-6 sm:grid-cols-2">
          <Funnel title="Last 30 days" stages={stats.funnel30} />
          <Funnel title="All time" stages={stats.funnelAll} />
        </div>
        <div className="mt-4 space-y-1">
          <Tripwire value={activated.conversion} {...TRIPWIRES.activated} label="Activated" />
          <Tripwire value={weekTwo.conversion} {...TRIPWIRES.weekTwo} label="Week-2 active" />
        </div>
      </Panel>

      <Panel title="By invite code">
        <p className="mb-3 text-xs text-[var(--crt-fg-dim)]">
          A code gets its own row once five people have signed up with it. Personal and smaller invites are pooled.
        </p>
        <Scroll>
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--crt-fg-dim)]">
                <th className="pr-3 font-normal">Code</th>
                <th className="pr-3 font-normal">Made</th>
                <th className="pr-3 text-right font-normal">Opened</th>
                <th className="pr-3 text-right font-normal">Signed up</th>
                <th className="pr-3 text-right font-normal">Activated</th>
                <th className="text-right font-normal">Week 2</th>
              </tr>
            </thead>
            <tbody>
              {stats.codes.map((row) => (
                <tr key={row.label}>
                  <td className="pr-3">{row.label}</td>
                  <td className="pr-3 text-[var(--crt-fg-dim)]">{row.made ?? "—"}</td>
                  <Cell value={row.opened} />
                  <Cell value={row.signedUp} />
                  <Cell value={row.activated} />
                  <Cell value={row.weekTwo} last />
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Panel>

      <Panel title="Retention">
        <ul className="space-y-1 text-sm">
          {stats.retention.map((row) => (
            <li key={row.day} className="flex justify-between gap-3">
              <span>Back on day {row.day}</span>
              <span>
                {row.share === null ? "—" : `${row.share}%`}{" "}
                <span className="text-xs text-[var(--crt-fg-dim)]">of {row.n} who signed up {row.day}+ days ago</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">Weekly signup cohorts: share who practised in each week after signing up.</p>
        <Scroll>
          <table className="mt-2 text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--crt-fg-dim)]">
                <th className="pr-3 font-normal">Week of</th>
                <th className="pr-3 text-right font-normal">People</th>
                {Array.from({ length: 8 }, (_, week) => (
                  <th key={week} className="pr-3 text-right font-normal">
                    W{week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.cohorts.map((cohort) => (
                <tr key={cohort.week}>
                  <td className="pr-3">{cohort.week}</td>
                  <Cell value={cohort.size} />
                  {Array.from({ length: 8 }, (_, week) => {
                    const cell = cohort.weeks[week];
                    return <Cell key={week} value={cell === undefined || cell === null ? null : cell} unit="%" />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Panel>

      <Panel title="Engagement · last 30 days">
        <ul className="space-y-1 text-sm">
          <Line label="Practised today" value={e.activeToday} />
          <Line label="Practised per day, on average" value={e.dailyAverage} />
          <Line label="Practised in the last 7 days" value={e.weekly} />
          <Line label="Practised in the last 30 days" value={e.monthly} />
          <Line label="Stickiness (daily ÷ monthly)" value={e.stickiness === null ? "—" : `${e.stickiness}%`} />
          <Line label="Opened the app but didn't practise" value={e.openedNotPractised === null ? "—" : `${e.openedNotPractised}% of ${e.appOpens} opens`} />
          <Line label="Steps finished of started" value={e.finishedShare === null ? "—" : `${e.finishedShare}% (${e.stepsFinished} of ${e.stepsStarted})`} />
          <Line label="Steps per day practised" value={e.stepsPerActiveDay ?? "—"} />
          <Line label="Streak reminders on" value={e.remindersOn} />
        </ul>
        <div className="mt-3 space-y-1">
          <Tripwire value={e.stickiness} {...TRIPWIRES.stickiness} label="Stickiness" />
          <Tripwire value={e.openedNotPractised} {...TRIPWIRES.openedNotPractised} label="Opened but didn't practise" />
          <Tripwire value={e.finishedShare} {...TRIPWIRES.finishedShare} label="Steps finished" />
        </div>
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">Current streaks</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {e.streaks.map((bucket) => (
            <li key={bucket.bucket}>
              {bucket.bucket}: <span className="text-[var(--crt-fg-bright)]">{bucket.learners}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tracking health · last 14 days">
        <Scroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--crt-fg-dim)]">
                <th className="pr-3 font-normal">Day</th>
                <th className="pr-3 text-right font-normal">Events</th>
                <th className="pr-3 text-right font-normal">Steps</th>
                <th className="pr-3 text-right font-normal">Heartbeats</th>
                <th className="font-normal" />
              </tr>
            </thead>
            <tbody>
              {stats.health.map((day) => (
                <tr key={day.day}>
                  <td className="pr-3">{day.day}</td>
                  <td className="pr-3 text-right">{day.events}</td>
                  <td className="pr-3 text-right">{day.steps}</td>
                  <td className="pr-3 text-right">{day.heartbeats}</td>
                  <td className="text-xs text-[var(--crt-accent)]">{day.broken ? "tracking may be broken" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </Panel>

      <p className="text-xs">
        <Link href="/learn">&larr; Home</Link>
      </p>
    </div>
  );
}

function Funnel({ title, stages }: { title: string; stages: FunnelStage[] }) {
  return (
    <div>
      <p className="text-xs text-[var(--crt-fg-dim)]">{title}</p>
      <ol className="mt-1 space-y-1 text-sm">
        {stages.map((stage) => (
          <li key={stage.name} className="flex flex-wrap justify-between gap-x-3">
            <span>{stage.name}</span>
            <span className="ml-auto whitespace-nowrap">
              <span className="text-[var(--crt-fg-bright)]">{stage.count}</span>
              {stage.conversion !== null ? <span className="text-[var(--crt-fg-dim)]"> · {stage.conversion}%</span> : null}
              {stage.pending ? <span className="text-xs text-[var(--crt-fg-dim)]"> (+{stage.pending} too soon)</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tripwire({ label, value, look, ...limit }: { label: string; value: number | null; look: string } & ({ below: number } | { above: number })) {
  const tripped = value !== null && ("below" in limit ? value < limit.below : value > limit.above);
  const rule = "below" in limit ? `under ${limit.below}%` : `over ${limit.above}%`;
  return (
    <p className={`text-xs ${tripped ? "text-[var(--crt-accent)]" : "text-[var(--crt-fg-dim)]"}`}>
      {tripped ? "▲ " : ""}
      {label} {rule} → look at {look}.
    </p>
  );
}

function Line({ label, value }: { label: string; value: number | string }) {
  return (
    <li className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="text-right text-[var(--crt-fg-bright)]">{value}</span>
    </li>
  );
}

function Cell({ value, unit = "", last = false }: { value: Shown | null; unit?: string; last?: boolean }) {
  return <td className={`${last ? "" : "pr-3"} text-right`}>{value === null ? "" : value === "<5" ? "<5" : `${value}${unit}`}</td>;
}

/** A wide table scrolls inside its panel; the page never scrolls sideways. */
function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
