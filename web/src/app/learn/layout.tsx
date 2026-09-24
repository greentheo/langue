import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { languageLabel } from "@/lib/vocab";
import { LEVEL_LABELS } from "@/lib/vocab/types";
import { PhosphorToggle } from "@/components/phosphor-toggle";
import type { Level } from "@/lib/vocab/types";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts only checks that a cookie exists. This is the real check.
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--crt-rule)] pb-3">
        <div className="flex items-baseline gap-4">
          <Link
            href="/learn"
            className="text-lg font-bold tracking-[0.2em] no-underline text-[var(--crt-fg-bright)] crt-glow"
          >
            LANGUE
          </Link>
          <span className="text-xs text-[var(--crt-fg-dim)]">
            {languageLabel(user.currentLanguage)} &middot;{" "}
            {user.currentLevel.toUpperCase()}{" "}
            {LEVEL_LABELS[user.currentLevel as Level] ?? ""}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--crt-fg-dim)]">
            {user.points.toLocaleString()} pts &middot; {user.streakDays}d streak
          </span>
          <PhosphorToggle />
          <form action={logout}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)] hover:text-[var(--crt-danger)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="py-6">{children}</main>
    </div>
  );
}
