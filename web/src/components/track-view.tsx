"use client";

/**
 * Counts a view of a public page (#109): one beacon when the page really
 * loads in a browser. A server render can't tell a real visit from Next's
 * prefetch, and crawlers that don't run scripts aren't visitors anyway.
 * Nothing is stored on the device.
 */

import { useEffect } from "react";

/** Paths already counted in this page load (React may run an effect twice in development). */
const sent = new Set<string>();

export function TrackView({ path }: { path: "/" | "/register" }) {
  useEffect(() => {
    if (sent.has(path)) return;
    sent.add(path);
    const body = new Blob([JSON.stringify({ type: "page.viewed", path })], { type: "application/json" });
    try {
      navigator.sendBeacon("/api/events", body);
    } catch {
      // Not counted, and nothing else changes.
    }
  }, [path]);
  return null;
}
