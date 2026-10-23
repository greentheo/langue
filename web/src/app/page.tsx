import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { Panel, Rule } from "@/components/crt";
import { PhosphorToggle } from "@/components/phosphor-toggle";

const BANNER = String.raw`
 ██╗      █████╗ ███╗   ██╗ ██████╗ ██╗   ██╗███████╗
 ██║     ██╔══██╗████╗  ██║██╔════╝ ██║   ██║██╔════╝
 ██║     ███████║██╔██╗ ██║██║  ███╗██║   ██║█████╗
 ██║     ██╔══██║██║╚██╗██║██║   ██║██║   ██║██╔══╝
 ███████╗██║  ██║██║ ╚████║╚██████╔╝╚██████╔╝███████╗
 ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚══════╝
`;

export default async function HomePage() {
  const user = await verifySession();
  if (user) redirect("/learn");

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <pre
          aria-label="LANGUE"
          className="text-[0.5rem] sm:text-[0.7rem] leading-tight text-[var(--crt-fg-bright)] crt-glow overflow-x-auto"
        >
          {BANNER}
        </pre>
        <PhosphorToggle />
      </div>

      {/* The words are the approved draft, firm/marketing/drafts/what-is-langue.md (#72): change them there first. */}
      <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
        A language course in short daily steps, where you type the answers yourself.
      </p>

      <Rule />

      <Panel title="What it teaches">
        <p className="text-sm">
          Italian, Spanish, French and Brazilian Portuguese. Beginner (A1) and Elementary (A2) are complete in all
          four, about a thousand words in all. The levels are built on the CEFR, the European scale from A1 to C2.
          Higher levels aren&apos;t built yet.
        </p>
      </Panel>

      <Panel title="How it works" className="mt-8">
        <ul className="space-y-2 text-sm">
          <Point lead="Short steps.">
            Each step is planned for about three minutes. One button picks the next one: something new, reviews that
            are due, and the things you keep missing.
          </Point>
          <Point lead="You produce the language.">
            A new word climbs from recognising it, to recalling it, to typing it, to using it in a sentence and in a
            role-play.
          </Point>
          <Point lead="Endings count.">
            A slip that changes a word&apos;s ending (<em>cansados</em> for <em>cansadas</em>, <em>comemos</em> for{" "}
            <em>comimos</em>) is marked wrong, not forgiven as a typo, because the ending is the grammar. A missing
            accent, or a small typo in the middle of a word, is pointed out with the right spelling and still counts.
          </Point>
          <Point lead="Reviews come back">
            at growing intervals. A word counts as learned when you&apos;ve produced it on more than one day.
          </Point>
          <Point lead="Already know some?">
            Test out of the units you know. Each unit ends with a level-up challenge, and each level with a
            certificate.
          </Point>
        </ul>
      </Panel>

      <Panel title="Kind by design" className="mt-8">
        <ul className="space-y-2 text-sm">
          <Point>Your streak is never taken away, and progress bars only go up.</Point>
          <Point>No lives, no ads, nothing to pay.</Point>
          <Point>
            Reminders only if you turn them on: after two quiet days, then five, then twelve, and then they stop.
          </Point>
          <Point>
            Private groups. Each invite code is a group with its own leaderboard, and there&apos;s no messaging
            between learners.
          </Point>
        </ul>
      </Panel>

      <div className="mt-8 space-y-3 text-sm">
        <p>
          <strong className="text-[var(--crt-fg-bright)]">No AI in the daily steps.</strong> The steps, with their
          role-plays, grading and reviews, are fixed content and plain code, the same for everyone. A few optional
          extra tools do use AI: the &ldquo;Ask about this lesson&rdquo; box at the end of each lesson page, a
          conversation partner, some extra exercises (one is graded by AI), and the explanation you get when you miss
          a flashcard.
        </p>
        <p>
          <strong className="text-[var(--crt-fg-bright)]">Not built yet:</strong> speaking your answers aloud,
          dictation, writing tasks, and levels above A2.
        </p>
      </div>

      <Panel title="Access" className="mt-8">
        <p className="text-sm text-[var(--crt-fg-dim)]">Langue is invite-only, for family and friends.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className="crt-button crt-button-primary no-underline">
            Sign in
          </Link>
          <Link href="/register" className="crt-button no-underline">
            Redeem invite
          </Link>
        </div>
      </Panel>

      <footer className="mt-10 text-xs text-[var(--crt-fg-dim)]">
        Vocabulary shared with the Langue CLI. Press TAB to move, ENTER to submit.
      </footer>
    </main>
  );
}

/** One point in a panel's list, with an optional bold lead-in. */
function Point({ lead, children }: { lead?: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className="text-[var(--crt-fg-dim)]">
        -
      </span>
      <span>
        {lead ? <strong className="text-[var(--crt-fg-bright)]">{lead} </strong> : null}
        {children}
      </span>
    </li>
  );
}
