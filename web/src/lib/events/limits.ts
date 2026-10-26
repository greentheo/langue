/**
 * Bounds on the public events route (#109): anyone can send to it, so a body
 * has a size limit and an address a rate. Pure and in memory; a restart
 * resets them, which only ever lets a little more through.
 */

/** A body of at most `max` bytes, or null if it is bigger. Stops reading as soon as it is. */
export async function readLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** At most `limit` hits per key in each `windowMs`. */
export function createRateLimit(limit: number, windowMs: number) {
  const windows = new Map<string, { start: number; hits: number }>();
  return function allow(key: string, now: number = Date.now()): boolean {
    // Forget finished windows now and then, so the map stays small.
    if (windows.size > 10_000) for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
    const window = windows.get(key);
    if (!window || now - window.start >= windowMs) {
      windows.set(key, { start: now, hits: 1 });
      return true;
    }
    window.hits += 1;
    return window.hits <= limit;
  };
}
