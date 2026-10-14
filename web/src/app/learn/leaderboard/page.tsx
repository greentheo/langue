import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { groupsFor, leaderboard, type Group } from "@/lib/leaderboard";
import { joinGroup } from "@/lib/group-actions";
import type { BoardPeriod } from "@/lib/standings";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { StandingsTable } from "@/components/standings-table";

export const metadata = { title: "Leaderboard — LANGUE" };

const JOIN_MESSAGES: Record<string, string> = {
  ok: "You're in. This is the group's board.",
  unknown: "That code isn't one we know. Check it and try again.",
  expired: "That code has expired. Ask whoever shared it for a new one.",
};

/**
 * One board per invite-code group the learner belongs to — the code they
 * joined with, codes they made, and codes they joined later — with the code
 * to share for inviting others, and a box to join another group.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[]; period?: string | string[]; join?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const query = await searchParams;
  const groups = await groupsFor(user.id);
  const message = typeof query.join === "string" ? JOIN_MESSAGES[query.join] : undefined;

  if (groups.length === 0) {
    return (
      <>
        <ActivityHeader title="Leaderboard" />
        {message ? <p className="mb-4 text-sm text-[var(--crt-accent)]">{message}</p> : null}
        <Panel>
          <p className="text-sm">You&apos;re not in a group yet. Got a code from a friend? Join their group:</p>
          <JoinForm />
          {user.isAdmin ? (
            <p className="mt-4 text-sm text-[var(--crt-fg-dim)]">
              Or make a code on the <Link href="/learn/invites">invites page</Link> and share it — everyone who
              joins with it shares a board.
            </p>
          ) : null}
        </Panel>
      </>
    );
  }

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
        subtitle={`${group.name} · ${group.memberCount} learner${group.memberCount === 1 ? "" : "s"}`}
      />

      {message ? <p className="mb-4 text-sm text-[var(--crt-accent)]">{message}</p> : null}

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
              <span className="ml-1 text-[var(--crt-fg-dim)]">{candidate.memberCount}</span>
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
        {group.memberCount < 2 ? (
          <p className="mt-4 text-sm">Just you so far — share the code below to get a race going.</p>
        ) : null}
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
          Weekly points start again from zero every Monday, so anyone can top the
          week. Total points and streaks carry on. Only people in this group can
          see this board.
        </p>
      </Panel>

      <div className="mt-6">
        <Panel title="Invite and join">
          <InviteLine group={group} />
          <p className="mt-5 text-sm">Got a code for another group? Join it — your progress comes with you.</p>
          <JoinForm />
        </Panel>
      </div>
    </>
  );
}

function InviteLine({ group }: { group: Group }) {
  return (
    <div className="text-sm">
      <p>
        To invite someone to <span className="text-[var(--crt-fg-bright)]">{group.name}</span>, give them the code{" "}
        <span className="select-all whitespace-nowrap text-[var(--crt-accent)]">{group.code}</span>.
      </p>
      <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">
        {group.status === "active"
          ? "New people sign up with it; anyone who already has an account can join with it below."
          : group.status === "used-up"
            ? "It has no new accounts left, but people who already have an account can still join with it."
            : "It has expired, so nobody new can join with it."}
      </p>
    </div>
  );
}

function JoinForm() {
  return (
    <form action={joinGroup} className="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="crt-label" htmlFor="join-code">
          Group code
        </label>
        <input
          id="join-code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="XXXX-XXXX-XXXX"
          className="crt-input w-48 uppercase"
        />
      </div>
      <button type="submit" className="crt-button">
        Join
      </button>
    </form>
  );
}
