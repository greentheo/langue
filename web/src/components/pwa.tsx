"use client";

/**
 * Langue as an installed app: the service worker (public/sw.js) and the hint
 * that offers to put Langue on the home screen.
 */

import { useEffect, useState } from "react";

/** Registers the service worker, in production only — in development it would cache stale builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: Langue works the same in a plain browser tab.
    });
  }, []);
  return null;
}

/** The event Chrome fires when Langue could be installed; not in the DOM typings yet. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "langue.install.dismissed";

function installed(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function onIos(): boolean {
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * "Put Langue on your home screen": an Install button where the browser can
 * do it (Chrome on Android), Share → Add to Home Screen steps on iPhone and
 * iPad, nothing once installed or after "No thanks".
 */
export function InstallHint() {
  const [mode, setMode] = useState<"button" | "ios" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Storage blocked: show the hint; it just won't stay dismissed.
    }
    if (dismissed || installed()) return;

    if (onIos()) setMode("ios");
    const offer = (incoming: Event) => {
      incoming.preventDefault();
      setEvent(incoming as InstallEvent);
      setMode("button");
    };
    window.addEventListener("beforeinstallprompt", offer);
    return () => window.removeEventListener("beforeinstallprompt", offer);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Hidden for this visit at least.
    }
    setMode(null);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-[var(--crt-rule)] px-4 py-3 text-sm">
      <span className="flex-1">
        {mode === "button" ? (
          "Put Langue on your home screen — it opens like an app."
        ) : (
          <>
            Put Langue on your home screen: tap <span className="text-[var(--crt-fg-bright)]">Share</span>{" "}
            <span aria-hidden="true">⎋</span> then <span className="text-[var(--crt-fg-bright)]">Add to Home Screen</span>.
          </>
        )}
      </span>
      {mode === "button" ? (
        <button type="button" onClick={() => void install()} className="crt-button crt-button-primary px-3 py-1 text-xs">
          Install
        </button>
      ) : null}
      <button type="button" onClick={dismiss} className="text-xs text-[var(--crt-fg-dim)] hover:text-[var(--crt-fg-bright)]">
        No thanks
      </button>
    </div>
  );
}
