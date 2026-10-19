/**
 * What Langue keeps about a learner, and for how long: the source of the
 * public /privacy page (#109; #63 adds deletion, admin powers and AI uses).
 *
 * Every table in the database has an entry here, and every text field in it
 * says whose words it holds (privacy-inventory.test.ts fails otherwise), so a
 * new table or a new place that stores what a learner typed can't ship
 * without this page saying so.
 */

/** Whose words a text field holds: what you typed, something about your device, or Langue's own. */
export type FieldKind = "you" | "device" | "langue";

export interface InventoryEntry {
  /** The Prisma model. */
  model: string;
  /** Plain English, for the page. */
  title: string;
  what: string;
  kept: string;
  /** Every String and Json field of the model. */
  fields: Record<string, FieldKind>;
}

const WITH_ACCOUNT = "As long as your account exists.";

export const INVENTORY: InventoryEntry[] = [
  {
    model: "User",
    title: "Your account",
    what: "Your name, email address, a scrambled form of your password (never the password itself), your languages and level, points and streak, and the invite you joined with.",
    kept: WITH_ACCOUNT,
    fields: {
      id: "langue",
      email: "you",
      displayName: "you",
      passwordHash: "langue",
      currentLanguage: "langue",
      currentLevel: "langue",
      nativeLanguage: "langue",
      inviteCodeId: "langue",
    },
  },
  {
    model: "Session",
    title: "Signing in",
    what: "One record per device you're signed in on, so you stay signed in, with the name your browser gives itself.",
    kept: "Removed when you sign out; it stops working after 30 days.",
    fields: { id: "langue", tokenHash: "langue", userId: "langue", userAgent: "device" },
  },
  {
    model: "InviteCode",
    title: "Invite codes",
    what: "The codes that let people join, with the note the person who made one wrote for it and how many times it was used.",
    kept: "Until whoever made it removes it.",
    fields: { id: "langue", code: "langue", note: "you", createdById: "langue" },
  },
  {
    model: "GroupMember",
    title: "Your groups",
    what: "Which invite groups (and leaderboards) you're in.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", inviteCodeId: "langue" },
  },
  {
    model: "LanguageProgress",
    title: "Progress per language",
    what: "Your level and totals in each language you learn.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", language: "langue", level: "langue" },
  },
  {
    model: "WordStat",
    title: "Words you've practised",
    what: "How often you've seen each word, got it right or wrong, and when it's due for review.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", language: "langue", word: "langue" },
  },
  {
    model: "ActivityLog",
    title: "Practice log",
    what: "Each step or activity you finished: when, how long, how many right, the points, and how many misses were a wrong word ending.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", activityType: "langue", language: "langue", level: "langue", metadata: "langue" },
  },
  {
    model: "Achievement",
    title: "Badges and certificates",
    what: "Levels you've finished, and the numbers each certificate prints.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", name: "langue", detail: "langue" },
  },
  {
    model: "FlashcardReview",
    title: "Flashcard answers",
    what: "For each flashcard you answered: the word, the answer expected, and what you typed.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", language: "langue", level: "langue", word: "langue", expected: "langue", userAnswer: "you" },
  },
  {
    model: "LessonProgress",
    title: "Lessons",
    what: "Which lessons you've started and finished, and your best score.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", lessonId: "langue", language: "langue", level: "langue" },
  },
  {
    model: "ItemProgress",
    title: "What you know",
    what: "For each word, phrase and grammar idea on your path: how well you know it and when to review it.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", language: "langue", itemKey: "langue", kind: "langue" },
  },
  {
    model: "UnitMark",
    title: "Unit progress",
    what: "The best each unit's bar has shown you, so it never goes down.",
    kept: WITH_ACCOUNT,
    fields: { id: "langue", userId: "langue", unitId: "langue" },
  },
  {
    model: "PushSubscription",
    title: "Streak reminders",
    what: "If you turned reminders on: the address your browser gave for sending them, its keys, and your time zone, so a reminder comes at a sensible hour.",
    kept: "Until you turn reminders off, or your browser stops accepting them.",
    fields: { id: "langue", userId: "langue", endpoint: "device", p256dh: "device", auth: "device", timeZone: "device" },
  },
  {
    model: "Event",
    title: "Usage counts",
    what: "Short records Langue keeps to see whether it's working: a visit to the front or invite page, an invite opened, a signup, the app opened, a step started, the app installed, reminders turned on or off. They hold ids, page names and counts, never what you typed. Visits carry only the day's scrambled visitor code (below).",
    kept: "180 days, then deleted. Deleting your account deletes yours.",
    fields: { id: "langue", userId: "langue", visitor: "langue", type: "langue", props: "langue" },
  },
];

/** What the page says that isn't a table: how visitors are counted, and what stays on your device. */
export const NOTES: { title: string; text: string }[] = [
  {
    title: "Counting visitors without tracking them",
    text: "To count how many people visit the front page and the invite page, Langue makes a scrambled code from your internet address and browser name, mixed with a random value that changes every day and is never written down. Langue can't turn the code back into your address or connect one day's visitors to another's. Your internet address itself is never stored.",
  },
  {
    title: "On your device",
    text: "Langue stores no tracking cookie or identifier on your device. Once you sign in, there's a sign-in cookie so you stay signed in. Your display choices (colours, sound, voice, whether to show the install hint) stay in your browser and never reach Langue.",
  },
  {
    title: "Nobody else",
    text: "Nothing here is sent to advertisers, analytics companies or anyone else. There are no ads.",
  },
];
