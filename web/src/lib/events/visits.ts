/**
 * Joining an invite page view to the signup it led to, without a cookie
 * (#109). The register page puts a random one-time token in the form; the
 * invite.opened event and the signup event both record it. It joins that page
 * load to that signup and to nothing else.
 *
 * invite.opened is written once per daily visitor per code: a refresh reuses
 * the open (and its token) until someone signs up with it. After that the next
 * page load is a new open with a new token, so three people signing up one
 * after another on one family iPad are three opens, three signups and three
 * separate joins. Which opens came from one device is known only in memory,
 * for the day (visitor.ts), so nothing written links their accounts.
 */

import { randomBytes } from "node:crypto";

export function newVisitToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * The token for this page load, whether it is a new open to record, and
 * whether that open is this device's first of this code today.
 */
export function chooseVisit(
  lastOpen: { visit: string; signedUp: boolean } | null,
  fresh: () => string = newVisitToken,
): { visit: string; record: boolean; firstToday: boolean } {
  if (lastOpen && !lastOpen.signedUp) return { visit: lastOpen.visit, record: false, firstToday: false };
  return { visit: fresh(), record: true, firstToday: lastOpen === null };
}
