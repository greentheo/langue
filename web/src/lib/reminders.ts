/**
 * Streak reminders: when a learner who has gone quiet gets a nudge, and what
 * it says.
 *
 * Never daily — that is what made other apps annoying. The first reminder
 * comes after two days without practice, then at five and twelve days, then
 * no more until they practise again (which starts the schedule over). Always
 * in the early evening on the learner's phone.
 *
 * The messages say the streak is slipping; it never actually goes (see
 * lib/standings.ts: liveStreak). Pure, so the rules are unit-tested; the
 * sending is in reminder-sender.ts.
 */

/** Days without practice before each reminder. */
export const REMINDER_DAYS = [2, 5, 12] as const;

/** Local hours a reminder may arrive: 5pm up to 8pm. */
const EVENING_FROM = 17;
const EVENING_TO = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

function zone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** The calendar day a moment falls on in a time zone, as a day number. */
export function localDay(date: Date, timeZone?: string | null): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return Math.floor(Date.parse(`${parts}T00:00:00Z`) / DAY_MS);
}

export function localHour(date: Date, timeZone?: string | null): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: zone(timeZone), hour: "numeric", hourCycle: "h23" }).format(date),
  );
}

export interface ReminderLearner {
  streakDays: number;
  lastActiveAt: Date;
  reminderCount: number;
  lastRemindedAt: Date | null;
}

/**
 * Which reminder is due now (0 for the first), or null. Only for learners
 * who have practised at least once, only in the evening where they are, at
 * most one a day, and none after the last one in the schedule.
 */
export function reminderDue(learner: ReminderLearner, now: Date, timeZone?: string | null): number | null {
  if (learner.streakDays < 1) return null;
  const days = REMINDER_DAYS[learner.reminderCount];
  if (days === undefined) return null;

  const today = localDay(now, timeZone);
  if (today - localDay(learner.lastActiveAt, timeZone) < days) return null;
  if (learner.lastRemindedAt && localDay(learner.lastRemindedAt, timeZone) === today) return null;

  const hour = localHour(now, timeZone);
  if (hour < EVENING_FROM || hour >= EVENING_TO) return null;
  return learner.reminderCount;
}

/**
 * The notification. It names the learner, because a family may share one
 * phone, and gets a little more urgent each time.
 */
export function reminderMessage(
  name: string,
  streak: number,
  stage: number,
  language: string,
): { title: string; body: string } {
  const streakText = streak > 1 ? `${streak}-day streak` : "streak";
  switch (stage) {
    case 0:
      return {
        title: `${name}, your ${streakText} needs you`,
        body: `Three minutes of ${language} keeps it going.`,
      };
    case 1:
      return {
        title: `Don't let your ${streakText} slip, ${name}`,
        body: `One quick step of ${language} and it's safe again.`,
      };
    default:
      return {
        title: `${name}, your ${streakText} is hanging on`,
        body: `Your ${language} is waiting — pick up right where you left off.`,
      };
  }
}
