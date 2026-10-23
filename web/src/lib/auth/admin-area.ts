/**
 * The admin password confirmation's rules (#119), pure so they're tested and
 * so the browser can use them too (components/admin-watch.tsx).
 *
 * Several learners share one device and switch without a password, so an
 * admin page asks for the admin's password again: within the last 15 minutes,
 * in this session. The confirmation ends at whichever comes first: 15 minutes
 * after confirming (fixed, not extended), the first page outside the admin
 * area, or the admin page being hidden (screen lock, another app, another tab).
 */

export const ADMIN_CONFIRM_MS = 15 * 60 * 1000;

/** Is a confirmation made at `confirmedAt` still good at `now`? */
export function adminConfirmationLive(confirmedAt: Date | null, now: Date): boolean {
  return confirmedAt !== null && now.getTime() - confirmedAt.getTime() < ADMIN_CONFIRM_MS;
}

/** The admin area: leaving it ends the confirmation. */
export function isAdminArea(path: string | null | undefined): boolean {
  return /^\/learn\/(admin|invites)(\/|$)/.test(path ?? "");
}

const CONFIRM = "/learn/admin/confirm";

/** The page that asks for the password, then returns to `returnTo`. */
export function confirmPath(returnTo: string): string {
  return `${CONFIRM}?next=${encodeURIComponent(returnTo)}`;
}

/** Where to go after confirming: an admin page, or home. Never another site. */
export function safeReturnTo(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/learn";
  const path = next.split(/[?#]/)[0];
  return isAdminArea(path) && path !== CONFIRM ? next : "/learn";
}

/** At most `limit` wrong passwords per account in `windowMs`. In memory: a restart forgets, which only allows a few more. */
export function createWrongTries(limit: number, windowMs: number) {
  const tries = new Map<string, number[]>();
  const recent = (key: string, now: Date) => (tries.get(key) ?? []).filter((at) => now.getTime() - at < windowMs);
  return {
    blocked(key: string, now: Date): boolean {
      const kept = recent(key, now);
      if (kept.length > 0) tries.set(key, kept);
      else tries.delete(key);
      return kept.length >= limit;
    },
    fail(key: string, now: Date): void {
      tries.set(key, [...recent(key, now), now.getTime()]);
    },
    clear(key: string): void {
      tries.delete(key);
    },
  };
}
