/**
 * Short feedback sounds: a rising chime for a right answer, a falling one for
 * a miss, and a little run of notes when a step is done.
 *
 * Synthesised with the Web Audio API, so there are no files to download, and
 * silent while the sound switch is off (the same switch as pronunciation).
 * Browser-only, like speech.ts: call from event handlers and effects.
 */

import { isMuted } from "./speech";

export type Cue = "right" | "wrong" | "done";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  context ??= new Context();
  if (context.state === "suspended") void context.resume();
  return context;
}

/**
 * Browsers only start audio from a tap or key press, and an answer's sound
 * plays after the server has graded it. Calling this in the click handler,
 * before the request, gets audio going in time.
 */
export function primeSounds(): void {
  audio();
}

/** Overtones over the note, as multiples of its frequency, with their loudness. */
const BELL = [
  [1, 1],
  [2, 0.32],
  [3, 0.1],
  [4.2, 0.05],
] as const;

/** One struck bell note: a quick attack, then a long fade. */
function bell(ctx: AudioContext, frequency: number, start: number, length: number, volume: number) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
  envelope.connect(ctx.destination);

  for (const [ratio, loudness] of BELL) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * ratio;
    const gain = ctx.createGain();
    gain.gain.value = loudness;
    oscillator.connect(gain).connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }
}

/** Note frequencies in Hz. */
const C4 = 261.63;
const E4 = 329.63;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;

export function playCue(cue: Cue): void {
  if (isMuted()) return;
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime + 0.01;

  switch (cue) {
    case "right":
      // Two bright notes going up.
      bell(ctx, A5, now, 0.45, 0.16);
      bell(ctx, E6, now + 0.09, 0.7, 0.16);
      break;
    case "wrong":
      // Two soft, low notes going down.
      bell(ctx, E4, now, 0.35, 0.2);
      bell(ctx, C4, now + 0.16, 0.6, 0.2);
      break;
    case "done":
      // A quick run up the chord.
      [C5, E5, G5, C6].forEach((note, index) => bell(ctx, note, now + index * 0.09, 0.9, 0.13));
      break;
  }
}

/** How long to wait before speaking an answer, so the voice does not talk over the chime. */
export const CUE_MS = 380;
