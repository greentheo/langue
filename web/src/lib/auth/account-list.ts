/**
 * The list of other signed-in accounts on this device.
 *
 * A shared family iPad keeps several learners signed in at once. The active
 * learner's session token lives in the usual session cookie; the others wait
 * in a second cookie as a dot-separated list. Tokens are base64url, so a dot
 * can never appear inside one.
 *
 * Pure functions only, so the bookkeeping is testable without cookies.
 */

/** Learners one device can keep signed in at the same time. */
export const MAX_ACCOUNTS = 6;

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

export function parseTokenList(value: string | undefined): string[] {
  if (!value) return [];
  const tokens = value.split(".").filter((token) => TOKEN.test(token));
  return [...new Set(tokens)];
}

export function serializeTokenList(tokens: string[]): string {
  return tokens.join(".");
}

/**
 * Make `incoming` the active token, keeping the previous active one waiting.
 *
 * Returns the new waiting list and any tokens that fell off the end because
 * the device already holds MAX_ACCOUNTS learners — the caller deletes those
 * sessions so they do not linger in the database.
 */
export function activate(
  incoming: string,
  previousActive: string | null,
  waiting: string[],
): { waiting: string[]; evicted: string[] } {
  const queue = [previousActive, ...waiting].filter(
    (token): token is string => Boolean(token) && token !== incoming,
  );
  const unique = [...new Set(queue)];
  const keep = MAX_ACCOUNTS - 1;
  return { waiting: unique.slice(0, keep), evicted: unique.slice(keep) };
}
