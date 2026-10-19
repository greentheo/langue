import Link from "next/link";
import { headers } from "next/headers";
import { Panel } from "@/components/crt";
import { RegisterForm } from "@/components/auth-forms";
import { DeviceAccountsNote } from "@/components/device-accounts-note";
import { TrackView } from "@/components/track-view";
import { deviceAccounts } from "@/lib/auth/session";
import { inviteStatus } from "@/lib/auth/invite-status";
import { prisma } from "@/lib/db";
import { openInvite } from "@/lib/events/invites";
import { isBot } from "@/lib/events/props";
import { clientAddress, visitors } from "@/lib/events/visitor";
import { newVisitToken } from "@/lib/events/visits";

export const metadata = { title: "Create account — LANGUE" };

/**
 * Invite links arrive as /register?code=XXXX-XXXX-XXXX. Only the code's own
 * alphabet survives, so the query string cannot inject anything odd into the
 * field; the server still validates whatever is submitted.
 */
function codeFromQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 32);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const initialCode = codeFromQuery((await searchParams).code);
  const accounts = await deviceAccounts();
  const visit = await visitToken(initialCode);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="text-xs uppercase tracking-[0.2em] no-underline text-[var(--crt-fg-dim)]">
        &larr; Langue
      </Link>

      <h1 className="mt-4 text-2xl crt-glow">Create account</h1>
      <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">
        Registration is invite-only.
      </p>
      <DeviceAccountsNote accounts={accounts} />

      <Panel className="mt-6">
        <RegisterForm initialCode={initialCode} visit={visit} />
      </Panel>
      <p className="mt-6 text-xs text-[var(--crt-fg-dim)]">
        <Link href="/privacy">What Langue keeps</Link>
      </p>
      <TrackView path="/register" />
    </main>
  );
}

/**
 * The form's one-time visit token (lib/events/visits.ts). Opened with a valid
 * code, the page records invite.opened; the signup records the same token.
 */
async function visitToken(code: string): Promise<string> {
  if (!code) return newVisitToken();
  const invite = await prisma.inviteCode.findUnique({ where: { code } });
  const request = await headers();
  const userAgent = request.get("user-agent") ?? "";
  if (!invite || inviteStatus(invite) !== "active" || isBot(userAgent)) return newVisitToken();
  return openInvite(visitors.hash(clientAddress(request), userAgent), invite.id);
}
