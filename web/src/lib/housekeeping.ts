import "server-only";

/**
 * Housekeeping (#109): one hourly job for every "keep this only so long" rule,
 * started when the server starts (instrumentation.ts). It doesn't depend on
 * push keys or anything else being configured.
 *
 * To add a rule, add it to RULES: a name for the log and a function that does
 * the work and says what it did. #63 (sessions, deleted accounts), #49 (grading
 * reports) and #53 (mistake records) add theirs here, and each also gets a line
 * in lib/privacy-inventory.ts saying how long it keeps what.
 */

import { prisma } from "@/lib/db";
import { track } from "@/lib/events/track";
import { runRules, type HousekeepingRule } from "./housekeeping-rules";

export const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long events are kept (lib/privacy-inventory.ts says the same). */
export const EVENT_DAYS = 180;

export const RULES: HousekeepingRule[] = [
  {
    name: "old events",
    run: async (now) => {
      const { count } = await prisma.event.deleteMany({ where: { at: { lt: new Date(now.getTime() - EVENT_DAYS * DAY_MS) } } });
      return `${count} older than ${EVENT_DAYS} days deleted`;
    },
  },
  {
    // The dashboard shows heartbeats per day: a gap means this job, or the server, stopped.
    name: "heartbeat",
    run: async () => {
      if (process.env.EVENTS_OFF === "1") return "skipped (EVENTS_OFF)";
      await track("system.heartbeat");
      return "written";
    },
  },
];

let timer: ReturnType<typeof setInterval> | null = null;

/** Run every rule now and then every hour. Calling it again does nothing. */
export function startHousekeeping(rules: HousekeepingRule[] = RULES): void {
  if (timer) return;
  const tick = () => void runRules(rules, new Date());
  tick();
  timer = setInterval(tick, HOUR_MS);
  timer.unref?.();
}
