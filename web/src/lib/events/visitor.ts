/**
 * Counting unique visitors to the public pages without a cookie or anything
 * else stored on the device (#109).
 *
 * The visitor is a hash of IP address and browser (user agent) with a random
 * salt made each day and kept only in this process's memory. It is never
 * written anywhere, so nobody, us included, can recompute a stored hash or link
 * one day's visitors to the next day's; a restart makes a new salt too. The raw
 * IP address is never stored. This is the cookieless method privacy-first
 * analytics use: Plausible, for one, hashes "daily_salt + website_domain +
 * ip_address + user_agent" with a salt rotated and deleted every 24 hours
 * (https://plausible.io/data-policy). Ours never leaves memory at all.
 *
 * One server process is one salt: with several instances the same visitor
 * would count once per instance. Langue runs one.
 */

import { createHash, randomBytes } from "node:crypto";

/** The UTC day a salt is for: "2026-10-19". */
function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** A hasher with its own salt, made fresh for each day it sees. */
export function createVisitorHasher(random: (size: number) => Buffer = randomBytes) {
  let salt: { day: string; value: Buffer } | null = null;
  return (address: string, userAgent: string, now: Date = new Date()): string => {
    const day = dayOf(now);
    if (salt?.day !== day) salt = { day, value: random(32) };
    return createHash("sha256").update(salt.value).update(address).update("\n").update(userAgent).digest("hex").slice(0, 32);
  };
}

/** The server's hasher: one salt per day, gone when the process ends. */
export const visitorHash = createVisitorHasher();

/** The visitor's IP address as the proxy in front of the app reports it. */
export function clientAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "";
}
