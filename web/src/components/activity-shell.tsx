"use client";

/**
 * Chrome shared by every activity: title, back link, and a results summary.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/crt";

export function ActivityHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <Link
        href="/learn"
        className="text-xs uppercase tracking-[0.18em] no-underline text-[var(--crt-fg-dim)]"
      >
        &larr; Menu
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl crt-glow">{title}</h1>
        {children}
      </div>
      {subtitle ? (
        <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <span
      className="text-xs tracking-[0.3em] text-[var(--crt-fg-dim)]"
      aria-label={`Item ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) =>
        i < current ? "•" : i === current ? "▸" : "·",
      ).join("")}
    </span>
  );
}

export function SessionSummary({
  correct,
  total,
  points,
  onRestart,
}: {
  correct: number;
  total: number;
  points: number;
  onRestart: () => void;
}) {
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <Panel title="Session complete">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl text-[var(--crt-fg-bright)] crt-glow">
            {correct}/{total}
          </div>
          <div className="text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--crt-fg-dim)]">
            Correct
          </div>
        </div>
        <div>
          <div className="text-2xl text-[var(--crt-fg-bright)] crt-glow">{percent}%</div>
          <div className="text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--crt-fg-dim)]">
            Accuracy
          </div>
        </div>
        <div>
          <div className="text-2xl text-[var(--crt-accent)] crt-glow">+{points}</div>
          <div className="text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--crt-fg-dim)]">
            Points
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onRestart} className="crt-button crt-button-primary">
          Again
        </button>
        <Link href="/learn" className="crt-button no-underline">
          Menu
        </Link>
      </div>
    </Panel>
  );
}

export function Loading({ label = "Generating" }: { label?: string }) {
  return (
    <p className="text-sm text-[var(--crt-fg-dim)]" role="status">
      {label}
      <span className="crt-cursor" aria-hidden="true" />
    </p>
  );
}
