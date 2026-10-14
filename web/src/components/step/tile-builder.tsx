"use client";

/**
 * Building a sentence from word tiles: tap a tile to add it to the sentence,
 * tap it in the sentence to put it back. A couple of the tiles do not belong.
 * Tiles are buttons, so it works from the keyboard too.
 */

import { useState } from "react";

export function TileBuilder({
  tiles,
  disabled,
  onChange,
}: {
  tiles: string[];
  disabled: boolean;
  onChange: (answer: string) => void;
}) {
  // Indices into `tiles`, in the order picked.
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onChange(next.map((index) => tiles[index]).join(" "));
  };

  const tile =
    "border border-[var(--crt-rule)] px-3 py-2 text-base normal-case tracking-normal text-[var(--crt-fg-bright)] hover:border-[var(--crt-accent)] disabled:opacity-60 disabled:hover:border-[var(--crt-rule)]";

  return (
    <div className="mt-4">
      <div
        className="flex min-h-[3.25rem] flex-wrap items-center gap-2 border-b border-[var(--crt-rule)] pb-2"
        aria-label="Your sentence"
        aria-live="polite"
      >
        {picked.length === 0 ? (
          <span className="text-sm text-[var(--crt-fg-dim)]">Tap the words in order</span>
        ) : (
          picked.map((index, position) => (
            <button
              key={`${index}-${position}`}
              type="button"
              className={tile}
              disabled={disabled}
              onClick={() => update(picked.filter((_, at) => at !== position))}
              aria-label={`Remove ${tiles[index]}`}
            >
              {tiles[index]}
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tiles.map((word, index) =>
          picked.includes(index) ? (
            // Keep the space, so the other tiles do not jump around.
            <span key={index} className={`${tile} invisible`} aria-hidden="true">
              {word}
            </span>
          ) : (
            <button
              key={index}
              type="button"
              className={tile}
              disabled={disabled}
              onClick={() => update([...picked, index])}
            >
              {word}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
