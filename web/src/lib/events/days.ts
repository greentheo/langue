/** Days for events (#109): UTC, the day the rest of the app keeps too (boards, streaks). */

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Is this the learner's first request of the day: no app.opened yet today? */
export function opensNewDay(lastOpened: Date | null, now: Date): boolean {
  return lastOpened === null || utcDay(lastOpened) !== utcDay(now);
}
