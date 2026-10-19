import "server-only";

/**
 * app.opened (#109): a signed-in learner's first request of the day. Next to
 * the steps they finish, it shows who opened Langue and didn't practise.
 */

import { prisma } from "@/lib/db";
import { opensNewDay, utcDay } from "./days";
import { track } from "./track";

/** Learners already counted today by this server, so most requests skip the query. */
const counted = new Map<string, string>();

export async function trackAppOpened(userId: string, now: Date = new Date()): Promise<void> {
  if (process.env.EVENTS_OFF === "1" || counted.get(userId) === utcDay(now)) return;
  try {
    const last = await prisma.event.findFirst({
      where: { userId, type: "app.opened" },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    if (opensNewDay(last?.at ?? null, now)) await track("app.opened", { userId });
    counted.set(userId, utcDay(now));
  } catch (error) {
    console.error(`[langue] app.opened not checked: ${(error as Error).message}`);
  }
}
