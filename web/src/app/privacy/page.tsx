import Link from "next/link";
import { Panel } from "@/components/crt";
import { INVENTORY, NOTES } from "@/lib/privacy-inventory";

export const metadata = { title: "What Langue keeps — LANGUE" };

/**
 * What Langue keeps about you and for how long (#109), read straight from
 * lib/privacy-inventory.ts, whose test fails when a table or a field that
 * holds what you typed isn't listed. Public: you can read it before joining.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]">
        &larr; Langue
      </Link>
      <h1 className="mt-4 text-2xl crt-glow">What Langue keeps</h1>
      <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
        Everything Langue stores about you, and how long it keeps it. It all stays in Langue&apos;s own
        database.
      </p>

      <div className="mt-6 space-y-4">
        {NOTES.map((note) => (
          <Panel key={note.title} title={note.title}>
            <p className="text-sm">{note.text}</p>
          </Panel>
        ))}
      </div>

      <h2 className="mt-8 text-lg text-[var(--crt-fg-bright)]">In the database</h2>
      <ul className="mt-3 space-y-4">
        {INVENTORY.map((entry) => (
          <li key={entry.model} className="border-l-2 border-[var(--crt-rule)] pl-3">
            <p className="text-sm text-[var(--crt-fg-bright)]">{entry.title}</p>
            <p className="mt-1 text-sm">{entry.what}</p>
            <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">Kept: {entry.kept}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
