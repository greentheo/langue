import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks, parseInline } from "./rich-text";

describe("parseInline", () => {
  test("splits bold and italic runs", () => {
    assert.deepEqual(parseInline("Usually **-o** is *masculine*."), [
      { kind: "text", text: "Usually " },
      { kind: "bold", text: "-o" },
      { kind: "text", text: " is " },
      { kind: "italic", text: "masculine" },
      { kind: "text", text: "." },
    ]);
  });

  test("plain text is one token", () => {
    assert.deepEqual(parseInline("ciao"), [{ kind: "text", text: "ciao" }]);
  });

  test("an unmatched asterisk stays literal", () => {
    assert.deepEqual(parseInline("5 * 3"), [{ kind: "text", text: "5 * 3" }]);
  });

  test("never produces markup, only tokens", () => {
    const tokens = parseInline("<b>hi</b> **x**");
    assert.equal(tokens[0].text, "<b>hi</b> ");
  });
});

describe("parseBlocks", () => {
  test("blank lines separate paragraphs and wrapped lines join", () => {
    const blocks = parseBlocks("One line\ncontinues.\n\nSecond paragraph.");
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], {
      kind: "paragraph",
      inline: [{ kind: "text", text: "One line continues." }],
    });
  });

  test("consecutive bullets form one list, even straight after a paragraph", () => {
    const blocks = parseBlocks("The ending tells you:\n\n- **-o** masculine\n- **-a** feminine\n\nDone.");
    assert.deepEqual(
      blocks.map((block) => block.kind),
      ["paragraph", "list", "paragraph"],
    );
    const list = blocks[1];
    assert.equal(list.kind === "list" && list.items.length, 2);
  });

  test("a paragraph directly followed by bullets without a blank line splits", () => {
    const blocks = parseBlocks("Intro:\n- one\n- two");
    assert.deepEqual(
      blocks.map((block) => block.kind),
      ["paragraph", "list"],
    );
  });
});
