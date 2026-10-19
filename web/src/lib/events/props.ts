/**
 * What an event may say about itself (#109). Pure, so it is tested directly.
 *
 * Events hold ids, the public paths we count, counts, milliseconds and flags,
 * and nothing else: no typed text, no names, no emails, no answers, no
 * visitor id. A prop that is
 * not on this list, or whose value doesn't look like what the list says, is
 * dropped before anything is written.
 */

export const EVENT_TYPES = [
  "page.viewed",
  "invite.opened",
  "signup",
  "app.opened",
  "step.started",
  "app.installed",
  "reminders.on",
  "reminders.off",
  "system.heartbeat",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** The only pages whose views are counted: the funnel's front door. /login isn't part of it. */
export const TRACKED_PATHS = ["/", "/register"] as const;

/** A database id (cuid). */
const ID = /^[a-z0-9]{20,40}$/;
/** A one-time visit token (lib/events/invites.ts): 32 hex characters. */
export const VISIT_TOKEN = /^[0-9a-f]{32}$/;

const isCount = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e9;

/** Every prop any event may carry, and what its value must look like. */
const ALLOWED: Record<string, (value: unknown) => boolean> = {
  path: (value) => typeof value === "string" && (TRACKED_PATHS as readonly string[]).includes(value),
  inviteCodeId: (value) => typeof value === "string" && ID.test(value),
  visit: (value) => typeof value === "string" && VISIT_TOKEN.test(value),
  exercises: isCount,
  challenge: (value) => value === 0 || value === 1,
  ms: isCount,
  /** A device's first visit of the day to this page, or first open of this invite (visitor.ts). */
  firstToday: (value) => typeof value === "boolean",
};

/** The props an event keeps: allowed keys with well-formed values; everything else is gone. */
export function cleanProps(props: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const kept: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (ALLOWED[key]?.(value)) kept[key] = value as string | number | boolean;
  }
  return kept;
}

/**
 * Crawlers and link previews aren't visitors. Invite links travel by chat app,
 * and each one fetches the page to draw a preview: WhatsApp, iMessage (which
 * says Twitterbot or facebookexternalhit), Telegram, Slack, Discord, Facebook,
 * LinkedIn, Skype, Signal.
 */
export function isBot(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|whatsapp|facebookexternalhit|facebot|twitterbot|telegram|slack|discord|linkedin|skypeuri|signal|embedly|vkshare|pinterest/i.test(
    userAgent,
  );
}
