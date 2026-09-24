import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Optimistic auth redirect.
 *
 * This checks only for the *presence* of a session cookie — it never validates
 * it. Real authorization happens in the data access layer (lib/auth/session.ts),
 * which is the only place that touches the database. The Next.js docs are
 * explicit that proxy is the wrong layer for session verification: it runs on
 * every matched request and cannot be the security boundary.
 *
 * The point is purely UX: send a signed-out visitor to /login without paying
 * for a page render first.
 */

const PUBLIC_PATHS = ["/", "/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie && !PUBLIC_PATHS.includes(pathname)) {
    const target = new URL("/login", request.url);
    // Preserve where they were headed so login can bounce them back.
    if (pathname !== "/") target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  // Signed-in users have no use for the auth screens.
  if (hasSessionCookie && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/learn", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Skipped, and why:
   *
   *  - `api/`      Route handlers authenticate themselves via requireUser and
   *                answer with 401 JSON. Redirecting them would hand `fetch`
   *                an HTML login page instead, and would make Railway's
   *                /api/health probe return 307 — a permanently failing
   *                health check and a deploy that never goes live.
   *  - `_next/`    Build output; matching it wastes work on every chunk.
   *  - assets      Same reasoning for images and icons.
   */
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
