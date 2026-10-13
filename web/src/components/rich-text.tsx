/**
 * Render lesson markup (see lib/rich-text.ts) as React elements.
 *
 * No "use client": it has no state, so it renders on the server for lesson
 * pages and inside client components alike.
 */

import { Fragment } from "react";
import { parseBlocks, parseInline, type InlineToken } from "@/lib/rich-text";

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) =>
        token.kind === "bold" ? (
          <strong key={index} className="text-[var(--crt-fg-bright)]">
            {token.text}
          </strong>
        ) : token.kind === "italic" ? (
          <em key={index} className="text-[var(--crt-accent)] not-italic">
            {token.text}
          </em>
        ) : (
          <Fragment key={index}>{token.text}</Fragment>
        ),
      )}
    </>
  );
}

/** One line of inline markup, e.g. a table cell or a `why`. */
export function RichInline({ text }: { text: string }) {
  return <Inline tokens={parseInline(text)} />;
}

/** Paragraphs and bullet lists. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {parseBlocks(text).map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index}>
            <Inline tokens={block.inline} />
          </p>
        ) : (
          <ul key={index} className="space-y-1 pl-5 list-[square] marker:text-[var(--crt-fg-dim)]">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline tokens={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
