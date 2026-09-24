import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, requireUser } from "@/lib/auth/session";
import { createInvite, listInvites } from "@/lib/auth/invites";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";

export const metadata = { title: "Invites — LANGUE" };

/**
 * Mint a new invite code.
 *
 * Re-checks admin inside the action. A server action is a public endpoint: the
 * page-level check that hides the link does not stop anyone from invoking it.
 */
async function mintInvite(formData: FormData) {
  "use server";

  const user = await requireUser();
  if (!user.isAdmin) {
    throw new Error("Only an admin can create invite codes.");
  }

  const note = String(formData.get("note") ?? "").trim() || undefined;
  const daysRaw = Number(formData.get("days"));
  const expiresInDays = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : undefined;

  await createInvite({ note, createdById: user.id, expiresInDays });
  revalidatePath("/learn/invites");
}

export default async function InvitesPage() {
  const user = await verifySession();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/learn");

  const invites = await listInvites();
  const unused = invites.filter((invite) => !invite.redeemedAt);

  return (
    <>
      <ActivityHeader
        title="Invite codes"
        subtitle="Each code creates exactly one account. Send one per friend."
      />

      <Panel title="New code">
        <form action={mintInvite} className="flex flex-wrap items-end gap-4">
          <div className="grow min-w-[12rem]">
            <label className="crt-label" htmlFor="note">
              Note (optional)
            </label>
            <input id="note" name="note" placeholder="for Sam" className="crt-input" />
          </div>
          <div className="w-32">
            <label className="crt-label" htmlFor="days">
              Expires (days)
            </label>
            <input
              id="days"
              name="days"
              type="number"
              min={1}
              max={365}
              placeholder="never"
              className="crt-input"
            />
          </div>
          <button type="submit" className="crt-button crt-button-primary">
            Generate
          </button>
        </form>
      </Panel>

      <Panel title={`Unused (${unused.length})`} className="mt-8">
        {unused.length === 0 ? (
          <p className="text-sm text-[var(--crt-fg-dim)]">No unused codes.</p>
        ) : (
          <ul className="space-y-2">
            {unused.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-baseline justify-between gap-3">
                <code className="text-lg tracking-[0.2em] text-[var(--crt-fg-bright)] crt-glow">
                  {invite.code}
                </code>
                <span className="text-xs text-[var(--crt-fg-dim)]">
                  {invite.note ? `${invite.note} · ` : ""}
                  {invite.expiresAt
                    ? `expires ${invite.expiresAt.toISOString().slice(0, 10)}`
                    : "no expiry"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Redeemed" className="mt-8">
        {invites.filter((invite) => invite.redeemedAt).length === 0 ? (
          <p className="text-sm text-[var(--crt-fg-dim)]">Nothing redeemed yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {invites
              .filter((invite) => invite.redeemedAt)
              .map((invite) => (
                <li key={invite.id} className="flex justify-between gap-3">
                  <code className="text-[var(--crt-fg-dim)]">{invite.code}</code>
                  <span>{invite.redeemedBy?.displayName ?? "unknown"}</span>
                  <span className="text-[var(--crt-fg-dim)]">
                    {invite.redeemedAt?.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
