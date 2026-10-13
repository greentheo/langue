import Link from "next/link";
import { redirect } from "next/navigation";
import { deviceAccounts } from "@/lib/auth/session";
import { logout, logoutEveryone, switchAccount } from "@/lib/auth/actions";
import { MAX_ACCOUNTS } from "@/lib/auth/account-list";
import { languageLabel } from "@/lib/vocab";
import { liveStreak } from "@/lib/standings";
import { SoundToggle } from "@/components/sound-toggle";

export const metadata = { title: "Who's learning? — LANGUE" };

/**
 * The learner picker for a shared device: everyone signed in here, one tap to
 * switch. Like profiles on a family TV — no password to switch, so it is for
 * devices whose users trust each other, which is the point.
 */
export default async function AccountsPage() {
  const accounts = await deviceAccounts();
  if (accounts.length === 0) redirect("/login");

  const now = new Date();
  const current = accounts.find((account) => account.active);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/learn"
          className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]"
        >
          &larr; Back
        </Link>
        <SoundToggle />
      </div>
      <h1 className="mt-4 text-2xl crt-glow">Who&apos;s learning?</h1>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {accounts.map((account) => {
          const details = (
            <>
              <span className="block text-2xl text-[var(--crt-fg-bright)] crt-glow">
                {account.displayName}
              </span>
              <span className="mt-1 block text-sm">
                {languageLabel(account.currentLanguage)} · {account.currentLevel.toUpperCase()}
              </span>
              <span className="mt-1 block text-xs text-[var(--crt-fg-dim)]">
                {account.points.toLocaleString()} pts ·{" "}
                {liveStreak(account.streakDays, account.lastActiveAt, now)}d streak
              </span>
            </>
          );

          return (
            <li key={account.id}>
              {account.active ? (
                <Link
                  href="/learn"
                  className="block h-full border-2 border-[var(--crt-accent)] p-5 no-underline hover:bg-[var(--crt-selection)]"
                >
                  <span className="mb-2 block text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
                    Using the app now
                  </span>
                  {details}
                </Link>
              ) : (
                <form action={switchAccount} className="h-full">
                  <input type="hidden" name="userId" value={account.id} />
                  <button
                    type="submit"
                    className="block h-full w-full border-2 border-[var(--crt-rule)] p-5 text-left hover:border-[var(--crt-fg-dim)] hover:bg-[var(--crt-selection)]"
                  >
                    <span className="mb-2 block text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]">
                      Tap to switch
                    </span>
                    {details}
                  </button>
                </form>
              )}
            </li>
          );
        })}

        {accounts.length < MAX_ACCOUNTS ? (
          <li>
            <Link
              href="/login?add=1"
              className="flex h-full min-h-32 items-center justify-center border-2 border-dashed border-[var(--crt-rule)] p-5 text-lg no-underline hover:border-[var(--crt-fg-dim)]"
            >
              + Add a learner
            </Link>
          </li>
        ) : null}
      </ul>

      <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
        New to Langue? Open your invite link on this device — you&apos;ll be added here too.
      </p>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--crt-rule)] pt-6">
        {current ? (
          <form action={logout}>
            <button type="submit" className="crt-button">
              Sign out {current.displayName}
            </button>
          </form>
        ) : null}
        {accounts.length > 1 ? (
          <form action={logoutEveryone}>
            <button type="submit" className="crt-button text-[var(--crt-danger)]">
              Sign out everyone
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
