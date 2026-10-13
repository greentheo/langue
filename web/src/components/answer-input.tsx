"use client";

/**
 * Text answer box, with an accent bar when the learner is typing in the target
 * language. Accented letters are hard to reach on an English keyboard, and
 * graded answers care about them (*e* is "and", *è* is "is").
 */

import type { RefObject } from "react";
import { languageSettings } from "@/lib/languages";

export function AnswerInput({
  id,
  value,
  onChange,
  inputRef,
  language,
  typing,
  disabled = false,
  label = "Your answer",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  language: string;
  /** Which language the answer is written in. */
  typing: "english" | "target";
  disabled?: boolean;
  label?: string;
}) {
  const accents = typing === "target" ? languageSettings(language).accents : [];

  function insert(char: string) {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + char + value.slice(end));

    // Put the caret after the inserted letter once React has re-rendered.
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + char.length, start + char.length);
    });
  }

  return (
    <div>
      <label className="crt-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="crt-input"
      />
      {accents.length > 0 && !disabled ? (
        <div className="mt-2 flex flex-wrap gap-1" aria-label="Accented letters">
          {accents.map((char) => (
            <button
              key={char}
              type="button"
              // Keep focus (and the caret position) in the input.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insert(char)}
              className="min-w-8 border border-[var(--crt-rule)] px-2 py-1 text-sm text-[var(--crt-fg-bright)] hover:border-[var(--crt-fg-dim)]"
            >
              {char}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
