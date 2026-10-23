/** Days for events (#109): UTC, the day the rest of the app keeps too (boards, streaks). */

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The request header proxy.ts sets to the page's path: layouts aren't told it. */
export const PATH_HEADER = "x-langue-path";

/**
 * Does loading this page count as opening the app? Not the admin pages: the
 * owner checking the stats isn't a learner opening Langue, and counting it
 * would push "opened, didn't practise" up every time they look.
 */
export function countsAsAppOpen(path: string | null): boolean {
  return !/^\/learn\/admin(\/|$)/.test(path ?? "");
}

/** Is this the learner's first request of the day: no app.opened yet today? */
export function opensNewDay(lastOpened: Date | null, now: Date): boolean {
  return lastOpened === null || utcDay(lastOpened) !== utcDay(now);
}
