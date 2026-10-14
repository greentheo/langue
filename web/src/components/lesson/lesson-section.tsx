/**
 * One lesson section's teaching: its explanation, table, examples and tip.
 *
 * Shared by the lesson page and the guided path's learn cards, so a section
 * reads the same wherever it is taught. No "use client": it has no state.
 */

import type { LessonSection } from "@/lib/curriculum/types";
import { RichInline, RichText } from "@/components/rich-text";
import { SpeakButton } from "@/components/speak-button";

export function LessonSectionBody({
  section,
  language,
}: {
  section: LessonSection;
  language: string;
}) {
  return (
    <>
      <RichText text={section.body} className="text-sm" />

      {section.table ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {section.table.columns.map((column, columnIndex) => (
                  <th
                    key={columnIndex}
                    className="border-b border-[var(--crt-rule)] px-2 py-1 text-left text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[var(--crt-rule)] last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-2 py-1.5 align-top ${
                        cellIndex === 0 ? "text-[var(--crt-fg-dim)]" : "text-[var(--crt-fg-bright)]"
                      }`}
                    >
                      <RichInline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.examples && section.examples.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {section.examples.map(([target, english], exampleIndex) => (
            <li key={exampleIndex} className="flex items-baseline gap-2">
              <SpeakButton text={target} language={language} />
              <span>
                <span className="text-[var(--crt-fg-bright)]">
                  <RichInline text={target} />
                </span>
                <span className="text-[var(--crt-fg-dim)]"> — {english}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.tip ? (
        <p className="mt-4 border-l-2 border-[var(--crt-accent)] pl-3 text-sm">
          <span className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
            Watch out{" "}
          </span>
          <RichInline text={section.tip} />
        </p>
      ) : null}
    </>
  );
}
