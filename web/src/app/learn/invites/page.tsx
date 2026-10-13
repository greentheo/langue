import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, requireUser } from "@/lib/auth/session";
import { createInvite, listInvites } from "@/lib/auth/invites";
import {
  inviteStatus,
  parseInviteUses,
  remainingUses,
  MAX_INVITE_USES,
  MIN_INVITE_USES,
  type InviteStatus,
} from "@/lib/auth/invite-status";
import { availableLanguages, languageLabel } from "@/lib/vocab";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { CopyInviteEmail } from "@/components/copy-invite-email";

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
  const maxUses = parseInviteUses(formData.get("uses") || 1);

  await createInvite({ note, createdById: user.id, expiresInDays, maxUses });
  revalidatePath("/learn/invites");
}

const STATUS_LABEL: Record<InviteStatus, string> = {
  active: "active",
  "used-up": "used up",
  expired: "expired",
};

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function InvitesPage() {
  const user = await verifySession();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/learn");

  const invites = await listInvites();
  const now = new Date();
  const withStatus = invites.map((invite) => ({ ...invite, status: inviteStatus(invite, now) }));
  const active = withStatus.filter((invite) => invite.status === "active");
  const finished = withStatus.filter((invite) => invite.status !== "active");
  const languages = availableLanguages().map(languageLabel);

  return (
    <>
      <ActivityHeader
        title="Invite codes"
        subtitle="A code creates as many accounts as its uses allow. Copy the email and send it on."
      />

      <Panel title="New code">
        <form action={mintInvite} className="flex flex-wrap items-end gap-4">
          <div className="grow min-w-[12rem]">
            <label className="crt-label" htmlFor="note">
              Note (optional)
            </label>
            <input id="note" name="note" placeholder="for Sam" className="crt-input" />
          </div>
          <div className="w-24">
            <label className="crt-label" htmlFor="uses">
              Uses
            </label>
            <input
              id="uses"
              name="uses"
              type="number"
              min={MIN_INVITE_USES}
              max={MAX_INVITE_USES}
              defaultValue={1}
              className="crt-input"
            />
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

      <Panel title={`Active (${active.length})`} className="mt-8">
        {active.length === 0 ? (
          <p className="text-sm text-[var(--crt-fg-dim)]">No active codes.</p>
        ) : (
          <ul className="space-y-5">
            {active.map((invite) => (
              <li key={invite.id} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <code className="text-lg tracking-[0.2em] text-[var(--crt-fg-bright)] crt-glow">
                    {invite.code}
                  </code>
                  <span className="text-xs text-[var(--crt-fg-dim)]">
                    {invite.note ? `${invite.note} · ` : ""}
                    {invite.useCount}/{invite.maxUses} used ·{" "}
                    {invite.expiresAt ? `expires ${formatDay(invite.expiresAt)}` : "no expiry"}
                  </span>
                </div>
                {invite.members.length > 0 ? (
                  <p className="text-xs text-[var(--crt-fg-dim)]">
                    Joined: {invite.members.map((member) => member.displayName).join(", ")}
                  </p>
                ) : null}
                <CopyInviteEmail
                  inviterName={user.displayName}
                  code={invite.code}
                  expiresAt={invite.expiresAt?.toISOString() ?? null}
                  languages={languages}
                  remainingUses={remainingUses(invite)}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Used up or expired" className="mt-8">
        {finished.length === 0 ? (
          <p className="text-sm text-[var(--crt-fg-dim)]">Nothing here yet.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {finished.map((invite) => (
              <li key={invite.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <code className="text-[var(--crt-fg-dim)]">{invite.code}</code>
                  <span className="text-[var(--crt-fg-dim)]">
                    {invite.note ? `${invite.note} · ` : ""}
                    {invite.useCount}/{invite.maxUses} used · {STATUS_LABEL[invite.status]}
                  </span>
                </div>
                <p className="mt-0.5">
                  {invite.members.length > 0
                    ? invite.members.map((member) => member.displayName).join(", ")
                    : "Nobody joined with this code."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
