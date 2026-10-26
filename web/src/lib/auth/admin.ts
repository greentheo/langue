import "server-only";

/**
 * The one guard for admin pages and admin actions (#119). Several learners
 * share one device and switch without a password, so being signed in as the
 * admin isn't enough: the admin must have typed their password in this
 * session within the last 15 minutes (admin-area.ts has the rules). Every
 * admin page and action calls this; admin-guard.test.ts fails on one that
 * doesn't.
 */

import { notFound, redirect } from "next/navigation";
import { verifySession, type SessionUser } from "./session";
import { adminConfirmationLive, confirmPath } from "./admin-area";

type Options =
  /** An admin page or action: needs a recent confirmation, and comes back to `returnTo` after one. */
  | { confirmed: true; returnTo: string }
  /** Only the page that asks for the password. */
  | { confirmed: false };

/** The signed-in admin, or: the sign-in page, a 404 for anyone else, or the password prompt. */
export async function requireAdmin(options: Options): Promise<SessionUser> {
  const user = await verifySession();
  if (!user) redirect("/login");
  if (!user.isAdmin) notFound();
  if (options.confirmed && !adminConfirmationLive(user.adminConfirmedAt, new Date())) redirect(confirmPath(options.returnTo));
  return user;
}
