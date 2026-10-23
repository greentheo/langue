/**
 * The "copy invite email" text.
 *
 * Plain text on purpose: it gets pasted into whatever the admin uses — Gmail,
 * a phone's mail app, a group chat — and plain text survives all of them.
 * Pure and free of browser APIs so it can be unit tested; the component
 * supplies the site origin.
 */

export interface InviteEmailInput {
  inviterName: string;
  code: string;
  /** Site origin, e.g. "https://langue.example.com". No trailing slash needed. */
  origin: string;
  /** ISO date string or null for codes that never expire. */
  expiresAt: string | null;
  /** Display names, e.g. ["French", "Italian"]. */
  languages: string[];
  remainingUses: number;
}

export interface InviteEmail {
  subject: string;
  body: string;
  /** Subject line plus body, ready to paste in one go. */
  text: string;
}

export function registerUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/register?code=${encodeURIComponent(code)}`;
}

/** "French, Italian and Spanish" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "October 14, 2026", in UTC so the date matches what the invites page shows. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildInviteEmail(input: InviteEmailInput): InviteEmail {
  const { inviterName, code, origin, expiresAt, languages, remainingUses } = input;
  const link = registerUrl(origin, code);

  // The words are the approved draft, firm/marketing/drafts/invite-message.md (#72): change them there first.
  const subject = "Join me on Langue";

  const offering = languages.length > 0 ? ` It teaches ${joinList(languages)}.` : "";

  const codeLine = [
    `Your invite code is ${code} (the link fills it in for you).`,
    expiresAt ? `It expires on ${formatDate(expiresAt)}.` : null,
    remainingUses > 1 ? `It works for ${remainingUses} more people.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const body = [
    "Hi!",
    "",
    `I've been learning with Langue, a small language app for family and friends.${offering}`,
    "",
    "What it's like:",
    "- Short steps, planned for about three minutes each. One button picks what's next: new words, reviews that are due, and the things you keep missing.",
    "- You type the answers yourself, and endings count: cansados for cansadas is marked wrong, not waved through as a typo, and so is parle for parlé, where the missing accent changes the meaning. A missing accent that makes no word, or a small typo, is pointed out with the right spelling.",
    "- Little role-plays from the first unit, like greeting a new friend or a neighbour.",
    "- Beginner (A1) and Elementary (A2) are complete. If you already know some, you can test out of the early units.",
    "- No ads, nothing to pay, and your streak is never taken away.",
    "",
    "Here's your invite:",
    link,
    "",
    codeLine,
    "",
    "Getting started:",
    "1. Open the link.",
    "2. Pick a name, your email and a password (at least 10 characters). Your name is what your group sees on the leaderboard.",
    "3. Choose your language and take your first step.",
    "",
    "On a phone, add Langue to your home screen and it works like an app.",
    "",
    "See you there,",
    inviterName,
  ].join("\n");

  return { subject, body, text: `Subject: ${subject}\n\n${body}` };
}
