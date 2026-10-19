/**
 * Counting unique visitors to the public pages without a cookie, without
 * anything stored on the device, and without writing any visitor id down
 * (#109).
 *
 * A visitor is a hash of IP address and browser (user agent) with a random
 * salt made each day and kept only in this process's memory. The hash never
 * leaves memory either: today's hashes are remembered beside the salt only to
 * tell whether a visit is a device's first today (written as `firstToday`) and
 * to keep a refreshed invite page on the same open. When the day changes or the
 * server restarts, salt and hashes are gone together, so nothing can link one
 * day's visitors to another's, and a restart mid-day can count a returning
 * visitor twice. The raw IP address is never stored.
 *
 * This is the cookieless method privacy-first analytics use: Plausible, for
 * one, hashes "daily_salt + website_domain + ip_address + user_agent" with a
 * salt rotated and deleted every 24 hours (https://plausible.io/data-policy).
 * Ours keeps salt and hashes in memory only.
 *
 * One server process is one salt: with several instances the same visitor
 * would count once per instance. Langue runs one.
 */

import { createHash, randomBytes } from "node:crypto";

/** The UTC day a salt is for: "2026-10-19". */
function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

interface Today {
  day: string;
  salt: Buffer;
  /** What has been seen today: "<hash> page:/", "<hash> install". */
  seen: Set<string>;
  /** Today's invite open per visitor and code, by its form token (visits.ts). */
  opens: Map<string, string>;
}

/** One day's visitors, remembered in memory and forgotten when the day changes. */
export function createDailyVisitors(random: (size: number) => Buffer = randomBytes) {
  let today: Today | null = null;
  const current = (now: Date): Today => {
    const day = dayOf(now);
    if (today?.day !== day) today = { day, salt: random(32), seen: new Set(), opens: new Map() };
    return today;
  };

  return {
    /** The visitor's hash for today. Never written anywhere. */
    hash(address: string, userAgent: string, now: Date = new Date()): string {
      return createHash("sha256").update(current(now).salt).update(address).update("\n").update(userAgent).digest("hex").slice(0, 32);
    },
    /** True the first time `key` (a hash and what it did) is seen today; remembered after that. */
    firstToday(key: string, now: Date = new Date()): boolean {
      const { seen } = current(now);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    /** The form token of today's open of an invite by this visitor, if any. */
    openToken(key: string, now: Date = new Date()): string | undefined {
      return current(now).opens.get(key);
    },
    rememberOpen(key: string, token: string, now: Date = new Date()): void {
      current(now).opens.set(key, token);
    },
  };
}

/** The server's visitors: one salt and one set of hashes per day, gone when the process ends. */
export const visitors = createDailyVisitors();

/**
 * The visitor's IP address. Railway's edge sets X-Real-IP "for identifying
 * client's remote IP" (https://docs.railway.com/networking/public-networking/specs-and-limits)
 * and, per Railway staff, overwrites the client-address headers a caller sends
 * (https://station.railway.com/questions/which-client-address-headers-does-the-ra-fb9e36d7).
 * The first X-Forwarded-For entry is the fallback for other hosts.
 */
export function clientAddress(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}
