"use client";

/**
 * Phosphor colour switcher: green / amber / paper.
 *
 * The preference lives in localStorage and is applied to <html> before paint by
 * PhosphorScript, so there is no flash of the wrong palette on load. That is
 * also why <html> carries suppressHydrationWarning — the inline script mutates
 * the attribute before React hydrates.
 */

import { useEffect, useState } from "react";

const PHOSPHORS = ["green", "amber", "paper"] as const;
type Phosphor = (typeof PHOSPHORS)[number];

const STORAGE_KEY = "langue-phosphor";

/**
 * Inline script that runs before first paint.
 *
 * Rendered into <head>, so it executes ahead of the body and the correct
 * palette is in place on the very first frame.
 */
export function PhosphorScript() {
  const script = `
    try {
      var p = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      if (p && p !== "green") document.documentElement.setAttribute("data-phosphor", p);
    } catch (e) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function PhosphorToggle() {
  const [phosphor, setPhosphor] = useState<Phosphor>("green");

  // Read the stored value after mount: the server has no localStorage, so
  // rendering it directly would mismatch on hydration.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Phosphor | null;
    if (stored && PHOSPHORS.includes(stored)) setPhosphor(stored);
  }, []);

  function choose(next: Phosphor) {
    setPhosphor(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (next === "green") {
      document.documentElement.removeAttribute("data-phosphor");
    } else {
      document.documentElement.setAttribute("data-phosphor", next);
    }
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Screen colour">
      {PHOSPHORS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={phosphor === option}
          title={`${option} screen`}
          className={`px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.14em] border transition-colors ${
            phosphor === option
              ? "border-[var(--crt-accent)] text-[var(--crt-accent)]"
              : "border-[var(--crt-rule)] text-[var(--crt-fg-dim)] hover:text-[var(--crt-fg)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
