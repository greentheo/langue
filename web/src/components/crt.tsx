/**
 * Shared CRT chrome.
 *
 * Server components by default — none of these need interactivity, and keeping
 * them off the client bundle matters when the panel wrapper appears on every
 * page.
 */

import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`crt-panel p-5 ${title ? "mt-3" : ""} ${className}`}>
      {title ? <h2 className="crt-panel-title">{title}</h2> : null}
      {children}
    </section>
  );
}

/** The `]` prompt the IIe printed before every line of input. */
export function Prompt({ children }: { children?: ReactNode }) {
  return (
    <span>
      <span className="text-[var(--crt-fg-dim)]">]</span> {children}
    </span>
  );
}

export function Cursor() {
  return <span className="crt-cursor" aria-hidden="true" />;
}

/** A labelled statistic, e.g. POINTS 1240. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--crt-fg-dim)]">
        {label}
      </div>
      <div className="text-xl text-[var(--crt-fg-bright)] crt-glow">{value}</div>
    </div>
  );
}

/**
 * Error box.
 *
 * Used wherever the model or network fails. It always shows the real reason —
 * the CLI's habit of replacing errors with plausible content is the single
 * worst thing this app could inherit.
 */
export function ErrorBox({ title = "Error", message }: { title?: string; message: string }) {
  return (
    <div
      role="alert"
      className="border border-[var(--crt-danger)] p-4 text-[var(--crt-danger)]"
    >
      <div className="text-xs uppercase tracking-[0.18em] mb-1">?{title}</div>
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  );
}

/** Full-width divider drawn with an em-dash rule. */
export function Rule() {
  return <hr className="crt-rule my-4" />;
}
