import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { groupsFor, leaderboard } from "@/lib/leaderboard";
import type { BoardPeriod } from "@/lib/standings";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { StandingsTable } from "@/components/standings-table";

export const metadata = { title: "Leaderboard — LANGUE" };

/** One board per invite-code group the learner belongs to. */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[]; period?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const groups = await groupsFor(user.id);

  if (groups.length === 0) {
    return (
      <>
        <ActivityHeader title="Leaderboard" />
        <Panel>
          <p className="text-sm">
            Your leaderboard appears once someone else joins with your invite code.
          </p>
          {user.isAdmin ? (
            <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
              Make a code with several uses on the <Link href="/learn/invites">invites page</Link>{" "}
              and share it — everyone who joins with it shares a board.
            </p>
          ) : null}
        </Panel>
      </>
    );
  }

  const query = await searchParams;
  const group = groups.find((candidate) => candidate.id === query.group) ?? groups[0];
  const period: BoardPeriod = query.period === "all" ? "all" : "week";
  const rows = await leaderboard(group.id, user.id, period);
  if (!rows) redirect("/learn/leaderboard");

  const link = (groupId: string, nextPeriod: BoardPeriod) =>
    `/learn/leaderboard?group=${groupId}${nextPeriod === "all" ? "&period=all" : ""}`;

  return (
    <>
      <ActivityHeader
        title="Leaderboard"
        subtitle={`${group.name} · ${group.memberCount} learners`}
      />

      {groups.length > 1 ? (
        <nav aria-label="Group" className="mb-4 flex flex-wrap gap-2">
          {groups.map((candidate) => (
            <Link
              key={candidate.id}
              href={link(candidate.id, period)}
              aria-current={candidate.id === group.id ? "page" : undefined}
              className={`crt-button no-underline px-3 py-1 text-xs normal-case tracking-normal ${
                candidate.id === group.id ? "crt-button-primary" : ""
              }`}
            >
              {candidate.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <nav aria-label="Rank by" className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]">Rank by</span>
        {(["week", "all"] as const).map((option) => (
          <Link
            key={option}
            href={link(group.id, option)}
            aria-current={option === period ? "page" : undefined}
            className={`crt-button no-underline px-3 py-1 text-xs ${
              option === period ? "crt-button-primary" : ""
            }`}
          >
            {option === "week" ? "Weekly points" : "Total points"}
          </Link>
        ))}
      </nav>

      <Panel>
        <StandingsTable rows={rows} period={period} viewerId={user.id} />
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
          Weekly points start again from zero every Monday, so anyone can top the
          week. Total points and streaks carry on. Only people in this group can
          see this board.
        </p>
      </Panel>
    </>
  );
}
