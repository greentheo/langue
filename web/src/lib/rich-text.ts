/**
 * The tiny markup lessons are written in.
 *
 * Lesson text needs bold, italics, paragraphs and bullet lists — nothing more.
 * A Markdown library would be a dependency and an HTML-injection surface for
 * four features, so this parses exactly those into tokens that the RichText
 * component renders as React elements. No string ever reaches the DOM as HTML.
 */

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string };

export type Block =
  | { kind: "paragraph"; inline: InlineToken[] }
  | { kind: "list"; items: InlineToken[][] };

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*/g;

/** Split a line into plain, **bold** and *italic* runs. */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: "text", text: text.slice(last, index) });
    if (match[1] !== undefined) tokens.push({ kind: "bold", text: match[1] });
    else tokens.push({ kind: "italic", text: match[2] });
    last = index + match[0].length;
  }

  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

const BULLET = /^\s*-\s+/;

/**
 * Split text into paragraphs and bullet lists. A blank line ends a block;
 * consecutive `- ` lines form one list; wrapped lines join with a space.
 */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", inline: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list.map(parseInline) });
      list = [];
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (BULLET.test(raw)) {
      flushParagraph();
      list.push(line.replace(BULLET, ""));
    } else if (list.length > 0 && /^\s{2,}/.test(raw)) {
      // An indented line continues the previous bullet.
      list[list.length - 1] += ` ${line}`;
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}
