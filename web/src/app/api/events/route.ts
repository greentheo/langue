import { z } from "zod";
import { handler, readJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isBot, TRACKED_PATHS } from "@/lib/events/props";
import { track } from "@/lib/events/track";
import { clientAddress, visitorHash } from "@/lib/events/visitor";

/**
 * Events the browser reports (#109): a view of a public page, and the app
 * being installed. Anyone may send them, signed in or not, so nothing here
 * belongs to an account: the visitor is the daily hash (lib/events/visitor.ts).
 * Always answers 204, so it tells a caller nothing.
 */

const BodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page.viewed"), path: z.enum(TRACKED_PATHS) }),
  z.object({ type: z.literal("app.installed") }),
]);

const NOTHING = new Response(null, { status: 204 });

/** Sent by one of Langue's own pages: the browser says so, or the Origin is the host we're served as. */
function fromLangue(headers: Headers): boolean {
  if (headers.get("sec-fetch-site") === "same-origin") return true;
  try {
    const origin = new URL(headers.get("origin") ?? "").host;
    return [headers.get("host"), headers.get("x-forwarded-host")].includes(origin);
  } catch {
    return false;
  }
}

export const POST = handler(async (request) => {
  const userAgent = request.headers.get("user-agent") ?? "";
  // Only Langue's own pages report events, and crawlers aren't visitors.
  if (!fromLangue(request.headers) || isBot(userAgent)) return NOTHING.clone();

  const body = BodySchema.safeParse(await readJson(request).catch(() => null));
  if (!body.success) return NOTHING.clone();

  const visitor = visitorHash(clientAddress(request.headers), userAgent);
  if (body.data.type === "page.viewed") {
    await track("page.viewed", { visitor, props: { path: body.data.path } });
  } else {
    // One install per device per day: the browser may report it more than once.
    const already = await prisma.event
      .findFirst({ where: { type: "app.installed", visitor }, select: { id: true } })
      .catch(() => null);
    if (!already) await track("app.installed", { visitor });
  }
  return NOTHING.clone();
});
