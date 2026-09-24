import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { extractJson, parseModelJson, ModelParseError } from "./parse";

describe("extractJson", () => {
  test("reads a bare JSON object", () => {
    assert.equal(extractJson('{"a":1}'), '{"a":1}');
  });

  test("reads a fenced json block", () => {
    const text = 'Here you go:\n```json\n{"a": 1}\n```\nHope that helps!';
    assert.equal(extractJson(text), '{"a": 1}');
  });

  test("reads an unlabelled fenced block", () => {
    assert.equal(extractJson('```\n[1, 2]\n```'), "[1, 2]");
  });

  test("ignores prose before and after", () => {
    const text = 'Sure! {"word": "ciao"} — let me know if you need more.';
    assert.equal(extractJson(text), '{"word": "ciao"}');
  });

  test("does not truncate on a brace inside a string", () => {
    const text = '{"note": "use } carefully", "n": 1}';
    assert.equal(extractJson(text), text);
  });

  test("handles escaped quotes inside strings", () => {
    const text = '{"note": "she said \\"ciao\\"", "n": 1}';
    assert.equal(extractJson(text), text);
  });

  test("reads a top-level array", () => {
    assert.equal(extractJson('[{"a":1},{"b":2}]'), '[{"a":1},{"b":2}]');
  });

  test("returns null when there is no JSON", () => {
    assert.equal(extractJson("I'm sorry, I can't help with that."), null);
  });
});

describe("parseModelJson", () => {
  const schema = z.object({ word: z.string(), count: z.number() });

  test("parses and validates", () => {
    const result = parseModelJson('```json\n{"word":"ciao","count":2}\n```', schema);
    assert.deepEqual(result, { word: "ciao", count: 2 });
  });

  test("throws ModelParseError when no JSON is present", () => {
    assert.throws(
      () => parseModelJson("no json here", schema),
      (error: unknown) => error instanceof ModelParseError,
    );
  });

  test("throws ModelParseError on malformed JSON", () => {
    assert.throws(
      () => parseModelJson('{"word": "ciao",}', schema),
      (error: unknown) => error instanceof ModelParseError,
    );
  });

  test("throws ModelParseError when the shape is wrong", () => {
    assert.throws(
      () => parseModelJson('{"word": "ciao"}', schema),
      (error: unknown) => error instanceof ModelParseError,
    );
  });

  test("attaches the raw response for logging", () => {
    try {
      parseModelJson("garbage", schema);
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof ModelParseError);
      assert.equal(error.raw, "garbage");
    }
  });
});
