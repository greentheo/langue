"use client";

/**
 * The sound switch in the header of every page. Big on purpose: on a shared
 * iPad it is the first thing someone reaches for in a quiet room.
 *
 * Off means practice no longer speaks by itself. The ▶ buttons still play
 * when tapped — that is an explicit request.
 */

import { useEffect } from "react";
import { setMuted, unlockSpeechOnFirstGesture, useMuted } from "@/lib/speech";

export function SoundToggle() {
  const muted = useMuted();

  // The toggle is on every page, which makes it the place to arm the iPad
  // speech unlock once per page load.
  useEffect(() => unlockSpeechOnFirstGesture(), []);

  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      title={
        muted
          ? "Sound is off. Tap to have practice read words aloud."
          : "Practice reads words aloud. Tap to turn sound off."
      }
      className={`crt-button gap-2 px-3 py-1.5 text-sm ${
        muted ? "text-[var(--crt-fg-dim)]" : "crt-button-primary"
      }`}
    >
      <span aria-hidden="true" className="tracking-normal">
        {muted ? "◄ ×" : "◄))"}
      </span>
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}
