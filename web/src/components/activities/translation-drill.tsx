"use client";

/**
 * Translation, with a direction switch.
 *
 * Thin wrapper over WrittenDrill: the only thing translation adds over
 * fill-in-the-blank is choosing which way to translate, and changing that has
 * to remount the drill so a fresh set is generated in the new direction.
 */

import { useState } from "react";
import { WrittenDrill } from "./written-drill";
import type { ActivityContext } from "@/lib/client-api";

type Direction = "to-target" | "to-native";

export function TranslationDrill({ context }: { context: ActivityContext }) {
  const [direction, setDirection] = useState<Direction>("to-target");

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]">
          Direction
        </span>
        {(
          [
            ["to-target", "Into target"],
            ["to-native", "Into English"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDirection(value)}
            aria-pressed={direction === value}
            className={`px-2 py-0.5 text-[0.6875rem] uppercase tracking-[0.14em] border transition-colors ${
              direction === value
                ? "border-[var(--crt-accent)] text-[var(--crt-accent)]"
                : "border-[var(--crt-rule)] text-[var(--crt-fg-dim)] hover:text-[var(--crt-fg)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* key forces a remount so switching direction generates a new set. */}
      <WrittenDrill
        key={direction}
        context={context}
        kind="translation"
        direction={direction}
      />
    </>
  );
}
