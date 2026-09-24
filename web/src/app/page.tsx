import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { availableLanguages, availableLevels, languageLabel, wordCount } from "@/lib/vocab";
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

  const languages = availableLanguages();

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

      <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
        AI language practice on a green screen. Apple IIe, 2026 edition.
      </p>

      <Rule />

      <Panel title="Catalog">
        <ul className="space-y-1 text-sm">
          {languages.map((language) => (
            <li key={language} className="flex justify-between gap-4">
              <span className="text-[var(--crt-fg-bright)]">
                {languageLabel(language)}
              </span>
              <span className="text-[var(--crt-fg-dim)]">
                {availableLevels(language).length} levels &middot;{" "}
                {wordCount(language).toLocaleString()} words
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Activities" className="mt-8">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--crt-fg-dim)]">
          <li>Flashcards &mdash; vocabulary drill</li>
          <li>Conversation &mdash; talk with a tutor</li>
          <li>Fill in the blank &mdash; grammar in context</li>
          <li>Translation &mdash; both directions</li>
          <li>Reading &mdash; passage and questions</li>
        </ul>
      </Panel>

      <Panel title="Access" className="mt-8">
        <p className="text-sm text-[var(--crt-fg-dim)]">
          This is a private deployment. Registration needs an invite code.
        </p>
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
