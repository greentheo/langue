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

  // Count an install (#109): no account, just that a device put Langue on its home screen.
  useEffect(() => {
    const installed = () => {
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "app.installed" }),
      }).catch(() => undefined);
    };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
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
            From there it can remind you when your streak needs you.
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

/** The VAPID public key as the bytes PushManager.subscribe wants. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function linkSubscription(subscription: PushSubscription): Promise<Response> {
  return post("/api/push/subscribe", {
    subscription: subscription.toJSON(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/**
 * Streak reminders on this phone: a card offering them while they're off, a
 * quiet line with "Send a test" and "Turn off" once on. Turning them on
 * covers every learner signed in on the device. Only where the browser can
 * do push — on iPhone, that means Langue installed on the home screen.
 */
export function ReminderToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "blocked" | "busy">("unsupported");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (cancelled) return;
        setState(subscription ? "on" : "off");
        // Include anyone who has signed in on this device since.
        if (subscription) await linkSubscription(subscription);
      })
      .catch(() => {
        if (!cancelled) setState("off");
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setState("busy");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const response = await linkSubscription(subscription);
      if (!response.ok) throw new Error("save failed");
      const { learners } = (await response.json()) as { learners: string[] };
      setState("on");
      setMessage(learners.length > 1 ? `On for ${learners.join(", ")}.` : "Reminders are on.");
    } catch {
      setState("off");
      setMessage("That didn't work — try again in a moment.");
    }
  }

  async function turnOff() {
    setState("busy");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await post("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
      await subscription.unsubscribe().catch(() => undefined);
    }
    setState("off");
    setMessage("Reminders are off on this device.");
  }

  async function test() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const response = await post("/api/push/test", { endpoint: subscription.endpoint });
    setMessage(response.ok ? "Sent — it should pop up in a moment." : "The test didn't go through.");
  }

  if (state === "unsupported") return null;

  if (state === "blocked") {
    return (
      <p className="text-xs text-[var(--crt-fg-dim)]">
        Streak reminders are blocked for Langue in this browser&apos;s notification settings.
      </p>
    );
  }

  if (state === "on") {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--crt-fg-dim)]">
        <span>Streak reminders are on.</span>
        <button type="button" onClick={() => void test()} className="underline hover:text-[var(--crt-fg-bright)]">
          Send a test
        </button>
        <button type="button" onClick={() => void turnOff()} className="underline hover:text-[var(--crt-fg-bright)]">
          Turn off
        </button>
        {message ? <span className="text-[var(--crt-accent)]">{message}</span> : null}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-[var(--crt-rule)] px-4 py-3 text-sm">
      <span className="flex-1">
        Want a nudge if your streak needs you? Only after two days away — never every day.
        {message ? <span className="ml-2 text-[var(--crt-accent)]">{message}</span> : null}
      </span>
      <button
        type="button"
        onClick={() => void turnOn()}
        disabled={state === "busy"}
        className="crt-button crt-button-primary px-3 py-1 text-xs"
      >
        {state === "busy" ? "…" : "Turn on reminders"}
      </button>
    </div>
  );
}
