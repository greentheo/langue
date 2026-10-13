import "server-only";

/**
 * Session management and the data access layer.
 *
 * Follows the Next.js DAL pattern: `verifySession` is the single place a
 * request's identity is established, memoized per render pass with React's
 * `cache`, and every data read goes through it. Authorization is never decided
 * in proxy.ts — that only does an optimistic cookie-presence redirect.
 */

import { cache } from "react";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { activate, parseTokenList, serializeTokenList } from "./account-list";

export const SESSION_COOKIE = "langue_session";

/**
 * Other learners signed in on this device, waiting to be switched to. See
 * account-list.ts. The active learner is always SESSION_COOKIE, so everything
 * that only cares about "who is this?" is unaffected by multiple accounts.
 */
export const ACCOUNTS_COOKIE = "langue_accounts";

/** Sessions last 30 days; long enough that friends aren't re-logging in weekly. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Store only a hash of the session token.
 *
 * A database leak then yields no usable cookies. SHA-256 is right here (unlike
 * for passwords): the token is 256 bits of CSPRNG output, so there is nothing
 * to brute-force and a slow KDF would only add latency to every request.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  currentLanguage: string;
  currentLevel: string;
  nativeLanguage: string;
  points: number;
  streakDays: number;
  /** Last time the user practised; the streak is only live if this is recent. */
  lastActiveAt: Date;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** The active token and the waiting ones, as the browser sent them. */
async function readTokens(): Promise<{ active: string | null; waiting: string[] }> {
  const cookieStore = await cookies();
  return {
    active: cookieStore.get(SESSION_COOKIE)?.value ?? null,
    waiting: parseTokenList(cookieStore.get(ACCOUNTS_COOKIE)?.value),
  };
}

/** Write both cookies. Only callable from server actions and route handlers. */
async function writeTokens(active: string | null, waiting: string[]): Promise<void> {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_TTL_MS);

  if (active) cookieStore.set(SESSION_COOKIE, active, cookieOptions(expires));
  else cookieStore.delete(SESSION_COOKIE);

  if (waiting.length > 0) {
    cookieStore.set(ACCOUNTS_COOKIE, serializeTokenList(waiting), cookieOptions(expires));
  } else {
    cookieStore.delete(ACCOUNTS_COOKIE);
  }
}

/** Live sessions behind a set of tokens, keyed by token. Expired ones are absent. */
async function liveSessions(tokens: string[]) {
  if (tokens.length === 0) return new Map<string, { userId: string }>();

  const byHash = new Map(tokens.map((token) => [hashToken(token), token]));
  const rows = await prisma.session.findMany({
    where: { tokenHash: { in: [...byHash.keys()] }, expiresAt: { gt: new Date() } },
    select: { tokenHash: true, userId: true },
  });

  return new Map(rows.map((row) => [byHash.get(row.tokenHash)!, { userId: row.userId }]));
}

async function deleteSessions(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  // deleteMany, not delete: an already-expired or swept row must not throw.
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens.map(hashToken) } } });
}

/**
 * Sign a user in on this device. Returns the raw token.
 *
 * Additive: whoever was active stays signed in and moves to the waiting list,
 * so a second child signing in on the family iPad does not sign out the
 * first. Signing in again as someone already on the device replaces their old
 * session rather than listing them twice.
 */
export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent },
  });

  const { active, waiting } = await readTokens();
  const live = await liveSessions([active, ...waiting].filter((t): t is string => Boolean(t)));

  const sameUser = [...live].filter(([, session]) => session.userId === userId).map(([t]) => t);
  const keep = (t: string | null) => Boolean(t) && live.has(t!) && !sameUser.includes(t!);

  const next = activate(token, keep(active) ? active : null, waiting.filter(keep));
  await deleteSessions([...sameUser, ...next.evicted]);
  await writeTokens(token, next.waiting);

  return token;
}

/**
 * Sign out the active learner only. Another learner signed in on this device,
 * if any, becomes active. Returns whether anyone is still signed in.
 */
export async function destroySession(): Promise<boolean> {
  const { active, waiting } = await readTokens();
  if (active) await deleteSessions([active]);

  const live = await liveSessions(waiting);
  const remaining = waiting.filter((token) => live.has(token));

  await writeTokens(remaining[0] ?? null, remaining.slice(1));
  return remaining.length > 0;
}

/** Sign out every learner on this device. */
export async function destroyAllSessions(): Promise<void> {
  const { active, waiting } = await readTokens();
  await deleteSessions([active, ...waiting].filter((t): t is string => Boolean(t)));
  await writeTokens(null, []);
}

/**
 * Make a learner already signed in on this device the active one. Returns
 * false if they are not among this device's live sessions — the user id comes
 * from a form, so it is only honoured if a waiting token really belongs to it.
 */
export async function switchSession(userId: string): Promise<boolean> {
  const { active, waiting } = await readTokens();
  const live = await liveSessions(waiting);
  const target = waiting.find((token) => live.get(token)?.userId === userId);
  if (!target) return false;

  const next = activate(target, active, waiting.filter((token) => live.has(token)));
  await deleteSessions(next.evicted);
  await writeTokens(target, next.waiting);
  return true;
}

export interface DeviceAccount {
  id: string;
  displayName: string;
  currentLanguage: string;
  currentLevel: string;
  points: number;
  streakDays: number;
  lastActiveAt: Date;
  active: boolean;
}

/**
 * Everyone signed in on this device, active learner first. Read-only: tokens
 * whose sessions have expired are skipped here and cleaned up the next time
 * a server action rewrites the cookies.
 */
export const deviceAccounts = cache(async (): Promise<DeviceAccount[]> => {
  const { active, waiting } = await readTokens();
  const ordered = [active, ...waiting].filter((t): t is string => Boolean(t));
  if (ordered.length === 0) return [];

  const byHash = new Map(ordered.map((token) => [hashToken(token), token]));
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: [...byHash.keys()] }, expiresAt: { gt: new Date() } },
    select: {
      tokenHash: true,
      user: {
        select: {
          id: true,
          displayName: true,
          currentLanguage: true,
          currentLevel: true,
          points: true,
          streakDays: true,
          lastActiveAt: true,
        },
      },
    },
  });

  const userByToken = new Map(sessions.map((row) => [byHash.get(row.tokenHash)!, row.user]));
  const seen = new Set<string>();
  const accounts: DeviceAccount[] = [];

  for (const token of ordered) {
    const user = userByToken.get(token);
    if (!user || seen.has(user.id)) continue;
    seen.add(user.id);
    accounts.push({ ...user, active: token === active });
  }

  return accounts;
});

/**
 * Resolve the current user, or null.
 *
 * Memoized for the render pass, so a layout and three components asking "who
 * is this?" cost one query rather than four.
 */
export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    currentLanguage: user.currentLanguage,
    currentLevel: user.currentLevel,
    nativeLanguage: user.nativeLanguage,
    points: user.points,
    streakDays: user.streakDays,
    lastActiveAt: user.lastActiveAt,
  };
});

/**
 * Resolve the current user or throw.
 *
 * For route handlers and server actions that have no meaning without a user.
 * Pages should call `verifySession` and redirect instead.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await verifySession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/** Compare two secrets without leaking length or content through timing. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Remove expired sessions. Cheap enough to call opportunistically on login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
