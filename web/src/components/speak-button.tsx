"use client";

/**
 * "Hear it" button.
 *
 * Plays a recorded clip when `src` is given, otherwise the browser's built-in
 * speech synthesis. Recorded clips are the upgrade path: phrases and examples
 * will get studio-quality audio generated once and served from object
 * storage, and passing `src` switches a button over with no other change. A
 * clip that fails to load falls back to the browser voice rather than going
 * silent.
 */

import { useEffect, useState } from "react";
import { languageSettings } from "@/lib/languages";

function speak(text: string, language: string) {
  const synth = window.speechSynthesis;
  synth.cancel();

  const { speechLang } = languageSettings(language);
  const prefix = speechLang.split("-")[0];
  const voices = synth.getVoices();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang;
  // Slightly slower than conversational speed — this is for learners.
  utterance.rate = 0.9;
  utterance.voice =
    voices.find((voice) => voice.lang === speechLang) ??
    voices.find((voice) => voice.lang.startsWith(prefix)) ??
    null;

  synth.speak(utterance);
}

export function SpeakButton({
  text,
  language,
  src,
  className = "",
}: {
  text: string;
  language: string;
  src?: string;
  className?: string;
}) {
  // Decided after mount: the server cannot know whether this browser speaks.
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(Boolean(src) || "speechSynthesis" in window);
  }, [src]);

  if (!available) return null;

  function play() {
    if (src) {
      new Audio(src).play().catch(() => speak(text, language));
      return;
    }
    speak(text, language);
  }

  return (
    <button
      type="button"
      onClick={play}
      title="Hear it"
      aria-label={`Hear it: ${text}`}
      className={`inline-flex shrink-0 items-center justify-center px-1.5 text-xs leading-none text-[var(--crt-fg-dim)] hover:text-[var(--crt-accent)] ${className}`}
    >
      ▶
    </button>
  );
}
