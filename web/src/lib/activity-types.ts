/**
 * Every activity that can record a session. One list, shared by the progress
 * route's validation, the server-side recorder and the browser helper, so a
 * new activity cannot be accepted in one place and rejected in another.
 */
export const ACTIVITY_TYPES = [
  "flashcards",
  "conversation",
  "fill_blank",
  "translation",
  "reading",
  "lesson",
  "phrases",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
