import "server-only";

/**
 * Sending streak reminders as web push notifications.
 *
 * The rules are in reminders.ts. This checks every hour, inside the web
 * server (started from instrumentation.ts), for learners due a nudge, and
 * sends it to every phone or browser they turned reminders on with. Off
 * entirely unless the VAPID keys are configured.
 *
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   npx web-push generate-vapid-keys
 *   VAPID_SUBJECT                         https://<the app's address> (optional)
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma } from "@/lib/db";
import { languageLabel } from "@/lib/languages";
import { REMINDER_DAYS, reminderDue, reminderMessage } from "./reminders";

const CHECK_EVERY_MS = 60 * 60 * 1000;
/** A reminder nobody saw for 12 hours is past its evening. */
const TTL_SECONDS = 12 * 60 * 60;

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification opens. */
  url: string;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let configured = false;

function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://github.com/greentheo/langue", publicKey, privateKey);
  configured = true;
  return true;
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send one notification. "gone" means the browser has dropped the
 * subscription (notifications turned off, app removed): the row should go.
 */
export async function sendPush(subscription: StoredSubscription, payload: PushPayload): Promise<"sent" | "gone" | "failed"> {
  if (!configure()) return "failed";
  const target: WebPushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  try {
    await webpush.sendNotification(target, JSON.stringify(payload), { TTL: TTL_SECONDS, urgency: "normal" });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[langue] push failed:", status ?? error);
    return "failed";
  }
}

/** Send to several subscriptions, removing the ones that are gone. True if any arrived. */
export async function sendToAll(subscriptions: StoredSubscription[], payload: PushPayload): Promise<boolean> {
  const results = await Promise.all(subscriptions.map((subscription) => sendPush(subscription, payload)));
  const gone = subscriptions.filter((_, index) => results[index] === "gone").map((subscription) => subscription.id);
  if (gone.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  return results.includes("sent");
}

/** Send every reminder that is due now. Returns how many learners were reminded. */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  if (!configure()) return 0;

  const learners = await prisma.user.findMany({
    where: {
      streakDays: { gte: 1 },
      reminderCount: { lt: REMINDER_DAYS.length },
      pushSubscriptions: { some: {} },
    },
    select: {
      id: true,
      displayName: true,
      currentLanguage: true,
      streakDays: true,
      lastActiveAt: true,
      reminderCount: true,
      lastRemindedAt: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true, timeZone: true } },
    },
  });

  let reminded = 0;
  for (const learner of learners) {
    const timeZone = learner.pushSubscriptions.find((subscription) => subscription.timeZone)?.timeZone;
    const stage = reminderDue(learner, now, timeZone);
    if (stage === null) continue;

    const message = reminderMessage(learner.displayName, learner.streakDays, stage, languageLabel(learner.currentLanguage));
    const arrived = await sendToAll(learner.pushSubscriptions, { ...message, url: "/learn" });
    if (!arrived) continue;

    await prisma.user.update({
      where: { id: learner.id },
      data: { reminderCount: stage + 1, lastRemindedAt: now },
    });
    reminded += 1;
  }
  return reminded;
}

const globalForReminders = globalThis as unknown as { langueReminders?: ReturnType<typeof setInterval> };

/** Check for due reminders now and every hour, once per server. */
export function startReminderSchedule(): void {
  if (!configure() || globalForReminders.langueReminders) return;

  const check = () => {
    sendDueReminders()
      .then((count) => {
        if (count > 0) console.log(`[langue] sent ${count} streak reminder(s)`);
      })
      .catch((error) => console.error("[langue] streak reminders failed:", error));
  };

  globalForReminders.langueReminders = setInterval(check, CHECK_EVERY_MS);
  globalForReminders.langueReminders.unref?.();
  // A first check a minute after starting, once the server is serving.
  setTimeout(check, 60 * 1000).unref?.();
  console.log("[langue] streak reminders: checking every hour");
}
