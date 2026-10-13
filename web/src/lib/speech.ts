/**
 * Speaking target-language text, and the device-wide sound setting.
 *
 * Browser-only: every function here touches window, and is called from
 * client components' event handlers and effects, never during render.
 *
 * `speak` is what the ▶ buttons use — an explicit tap always plays.
 * `autoSpeak` is what practice uses when a card appears or an answer is
 * revealed; it stays silent while sound is off. The setting is remembered per
 * device in localStorage and shared live between every component that shows
 * or uses it.
 */

import { useSyncExternalStore } from "react";
import { languageSettings } from "@/lib/languages";

const MUTED_KEY = "langue.sound.muted";
const CHANGE_EVENT = "langue:sound-change";

/** Lesson markup (*italic*, **bold**) is for the eye, not the voice. */
function plain(text: string): string {
  return text.replace(/\*+/g, "").replace(/_{2,}/g, " ").trim();
}

export function speak(text: string, language: string, src?: string): void {
  if (typeof window === "undefined") return;

  if (src) {
    // A recorded clip, when one exists; the browser voice if it will not play.
    new Audio(src).play().catch(() => speak(text, language));
    return;
  }

  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const { speechLang } = languageSettings(language);
  const prefix = speechLang.split("-")[0];
  const voices = synth.getVoices();

  const utterance = new SpeechSynthesisUtterance(plain(text));
  utterance.lang = speechLang;
  // Slightly slower than conversational speed — this is for learners.
  utterance.rate = 0.9;
  utterance.voice =
    voices.find((voice) => voice.lang === speechLang) ??
    voices.find((voice) => voice.lang.startsWith(prefix)) ??
    null;

  synth.speak(utterance);
}

/**
 * iPad and iPhone Safari stay silent until speech has been started from a tap
 * at least once on the page; after that, auto-play works. Speaking an empty
 * utterance on the first tap or key press anywhere satisfies that without a
 * sound. Returns a cleanup function for the listeners.
 */
export function unlockSpeechOnFirstGesture(): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};

  const unlock = () => {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    remove();
  };
  const remove = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return remove;
}

/** Stop anything currently being spoken. */
export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked: the change still applies until the page reloads.
  }
  if (muted) stopSpeaking();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Speak during practice, unless sound is off. */
export function autoSpeak(text: string | null | undefined, language: string): void {
  if (text && !isMuted()) speak(text, language);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab changing the setting.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The live sound setting. Renders as "on" on the server, then corrects. */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}
