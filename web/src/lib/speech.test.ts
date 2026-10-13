import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
// speech.ts only touches `window` when called, so the stand-in below is in
// place before anything here needs it.
import { autoSpeak, isMuted, setMuted, speak } from "./speech";

// A stand-in for the browser: storage, events and a speech engine that
// records what it was asked to say.
const spoken: { text: string; lang: string }[] = [];
let cancels = 0;
const store = new Map<string, string>();

Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    speechSynthesis: {
      cancel: () => void (cancels += 1),
      speak: (utterance: { text: string; lang: string }) => void spoken.push(utterance),
      getVoices: () => [],
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  SpeechSynthesisUtterance: class {
    text: string;
    lang = "";
    rate = 1;
    voice = null;
    constructor(text: string) {
      this.text = text;
    }
  },
});

describe("sound", () => {
  beforeEach(() => {
    spoken.length = 0;
    cancels = 0;
    store.clear();
  });

  test("sound is on until turned off", () => {
    assert.equal(isMuted(), false);
    autoSpeak("Ciao", "italian");
    assert.deepEqual(spoken.map((u) => [u.text, u.lang]), [["Ciao", "it-IT"]]);
  });

  test("muting silences auto-play and stops what is playing", () => {
    setMuted(true);
    assert.ok(cancels > 0);
    autoSpeak("Ciao", "italian");
    assert.equal(spoken.length, 0);
    assert.equal(isMuted(), true);
  });

  test("an explicit tap still speaks while muted", () => {
    setMuted(true);
    speak("Ciao", "italian");
    assert.equal(spoken.length, 1);
  });

  test("lesson markup is not read out", () => {
    speak("Il **libro** è *nuovo*.", "italian");
    assert.equal(spoken[0].text, "Il libro è nuovo.");
  });

  test("nothing to say is a no-op", () => {
    autoSpeak("", "italian");
    autoSpeak(null, "italian");
    assert.equal(spoken.length, 0);
  });
});
