import Link from "next/link";
import { Panel } from "@/components/crt";
import { LoginForm } from "@/components/auth-forms";
import { DeviceAccountsNote } from "@/components/device-accounts-note";
import { redirect } from "next/navigation";
import { deviceAccounts, verifySession } from "@/lib/auth/session";

export const metadata = { title: "Sign in — LANGUE" };

/** Sign in, or — with ?add=1 on a device someone already uses — add a learner. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  // Checked against the database, not just the cookie, so a stale cookie
  // shows the form instead of redirect-looping through /learn.
  if ((await verifySession()) && (await searchParams).add === undefined) redirect("/learn");

  const accounts = await deviceAccounts();
  const adding = accounts.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]">
        &larr; Langue
      </Link>

      <h1 className="mt-4 text-2xl crt-glow">{adding ? "Add a learner" : "Sign in"}</h1>
      <DeviceAccountsNote accounts={accounts} />

      <Panel className="mt-6">
        <LoginForm />
      </Panel>
    </main>
  );
}
