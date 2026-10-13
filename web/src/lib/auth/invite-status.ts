/**
 * Invite code status.
 *
 * Pure so the invites page, the registration action, and the tests all agree
 * on what "usable" means. The authoritative check at registration time is
 * still the conditional increment in claim-invite.ts — this only decides what
 * to show and which error message to give.
 */

export type InviteStatus = "active" | "used-up" | "expired";

export interface InviteUsage {
  maxUses: number;
  useCount: number;
  expiresAt: Date | null;
}

export function inviteStatus(invite: InviteUsage, now: Date = new Date()): InviteStatus {
  // Used-up wins over expired: "everyone you invited has joined" is the more
  // useful thing to tell an admin than "it would have expired anyway".
  if (invite.useCount >= invite.maxUses) return "used-up";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

export function remainingUses(invite: InviteUsage): number {
  return Math.max(0, invite.maxUses - invite.useCount);
}

/** Bounds for the "Uses" field: enough for a class, not an open door. */
export const MIN_INVITE_USES = 1;
export const MAX_INVITE_USES = 100;

/** Parse a uses value from a form or CLI flag, falling back to single-use. */
export function parseInviteUses(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < MIN_INVITE_USES) return MIN_INVITE_USES;
  return Math.min(parsed, MAX_INVITE_USES);
}
