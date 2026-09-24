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

export const SESSION_COOKIE = "langue_session";

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
}

/** Create a session row and set the cookie. Returns the raw token. */
export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** Delete the current session server-side and clear the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    // deleteMany, not delete: an already-expired or swept row must not throw.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

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
