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

  const subject = "Join me on Langue — learn a language with an AI tutor";

  const offering = languages.length > 0 ? ` Right now it teaches ${joinList(languages)}.` : "";

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
    "I've been using Langue, a little language-learning app. It looks like an " +
      "old Apple IIe screen, but behind it is an AI tutor: lessons, flashcards, " +
      `and real conversation practice at your own level.${offering}`,
    "",
    "You're invited. Here's your link:",
    link,
    "",
    codeLine,
    "",
    "Getting started:",
    "1. Open the link.",
    "2. Pick a name, your email and a password (at least 10 characters).",
    "3. Choose your language and level on the menu. If you're new to it, start at A1.",
    "",
    "See you there,",
    inviterName,
  ].join("\n");

  return { subject, body, text: `Subject: ${subject}\n\n${body}` };
}
