import { z } from "zod";
import { handler } from "@/lib/api";
import { readLimited } from "@/lib/events/limits";
import { isBot, TRACKED_PATHS } from "@/lib/events/props";
import { track } from "@/lib/events/track";
import { clientAddress, visitors } from "@/lib/events/visitor";

/**
 * Events the browser reports (#109): a view of a public page, and the app
 * being installed. Anyone may send them, signed in or not, so nothing here
 * belongs to an account and no visitor id is written: the daily hash stays in
 * memory and only `firstToday` is kept (lib/events/visitor.ts). Always answers
 * 204, so it tells a caller nothing.
 *
 * Bounded, since anyone can call it: bodies over 2 KB are refused unread, an
 * address may send 30 a minute (counted by its daily hash, never the address
 * itself), and crawlers and link previews are skipped.
 * The headers checked below can be forged by a script; these bounds are what
 * keep a forger to noise.
 */

const MAX_BODY = 2048;

const BodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page.viewed"), path: z.enum(TRACKED_PATHS) }),
  z.object({ type: z.literal("app.installed") }),
]);

const nothing = () => new Response(null, { status: 204 });

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
  const address = clientAddress(request.headers);
  if (!fromLangue(request.headers) || isBot(userAgent) || !visitors.allow(address)) return nothing();

  const text = await readLimited(request, MAX_BODY);
  if (text === null) return nothing();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return nothing();
  }
  const body = BodySchema.safeParse(json);
  if (!body.success) return nothing();

  const visitor = visitors.hash(address, userAgent);
  if (body.data.type === "page.viewed") {
    const { path } = body.data;
    await track("page.viewed", { props: { path, firstToday: visitors.firstToday(`${visitor} page:${path}`) } });
  } else if (visitors.firstToday(`${visitor} install`)) {
    // One install per device per day: the browser may report it more than once.
    await track("app.installed");
  }
  return nothing();
});
