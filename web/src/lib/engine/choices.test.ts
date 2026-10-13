import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildChoices } from "./choices";
import type { VocabWord } from "@/lib/vocab/types";

const word = (word: string, translations: string[], category = "basics"): VocabWord => ({
  word,
  translations,
  examples: [],
  category,
  difficulty: 1,
});

const ciao = word("ciao", ["hello", "hi", "bye"], "greetings");
const pool: VocabWord[] = [
  ciao,
  word("salve", ["hello"], "greetings"),
  word("buongiorno", ["good morning"], "greetings"),
  word("buonasera", ["good evening"], "greetings"),
  word("grazie", ["thank you"], "greetings"),
  word("pane", ["bread"], "food"),
  word("acqua", ["water"], "food"),
  word("vino", ["wine"], "food"),
];

describe("buildChoices", () => {
  test("returns four distinct options including the first translation", () => {
    for (let run = 0; run < 25; run += 1) {
      const options = buildChoices(ciao, pool);
      assert.equal(options.length, 4);
      assert.ok(options.includes("hello"));
      assert.equal(new Set(options).size, 4);
    }
  });

  test("never offers a distractor that is also a correct meaning", () => {
    for (let run = 0; run < 25; run += 1) {
      const options = buildChoices(ciao, pool);
      // "salve" also means hello, so it can never appear as a wrong option,
      // and the correct "hello" appears exactly once.
      assert.equal(options.filter((option) => option === "hello").length, 1);
      assert.ok(!options.includes("hi"));
      assert.ok(!options.includes("bye"));
    }
  });

  test("prefers distractors from the same category", () => {
    const options = buildChoices(ciao, pool);
    const greetings = ["good morning", "good evening", "thank you"];
    assert.deepEqual(
      options.filter((option) => option !== "hello").sort(),
      greetings.sort(),
    );
  });

  test("returns fewer options rather than duplicates when the pool is tiny", () => {
    const options = buildChoices(ciao, [ciao, word("pane", ["bread"])]);
    assert.deepEqual(options.sort(), ["bread", "hello"]);
  });
});
