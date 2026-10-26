/**
 * The admin-only pages, in one list for every rule about them (#109, #119):
 * opening one isn't a learner opening the app, and (#119) each asks for the
 * admin's password. Pure, so proxy.ts, the layouts and the browser share it.
 */

export const ADMIN_PATHS = ["/learn/admin", "/learn/invites"] as const;

/** Is this page admin-only? A path or anything under it: "/learn/admin/stats", not "/learn/administer". */
export function isAdminPath(path: string | null | undefined): boolean {
  return ADMIN_PATHS.some((prefix) => path === prefix || Boolean(path?.startsWith(`${prefix}/`)));
}

/** The request header proxy.ts sets, "1" on an admin-only page: layouts aren't told the path. */
export const ADMIN_PAGE_HEADER = "x-langue-admin-page";
