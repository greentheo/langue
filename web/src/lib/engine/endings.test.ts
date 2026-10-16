import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ENDINGS, ENDING_FLOOR, endingOf, isKnownForm, keepsEnding } from "./endings";
import { KNOWN_FORMS } from "./known-forms.generated";

describe("endings tables", () => {
  for (const language of ["italian", "spanish", "french", "portuguese"]) {
    test(`${language}: every listed ending is the ending of a word the course uses`, () => {
      const forms = KNOWN_FORMS[language].split(" ");
      assert.ok(forms.length > 1000, "the known-forms list was built");
      const invented = ENDINGS[language].filter(
        (ending) => !forms.some((form) => form.endsWith(ending) && form.length - ending.length >= 2),
      );
      assert.deepEqual(invented, []);
    });
  }

  test("endings are written as the grader compares them: lower-case, no accents", () => {
    for (const endings of Object.values(ENDINGS)) {
      for (const ending of endings) assert.match(ending, /^[a-z]+$/, ending);
    }
  });
});

describe("endingOf", () => {
  test("the longest listed ending wins", () => {
    assert.equal(endingOf("hablabamos", "spanish"), "abamos");
    assert.equal(endingOf("parlavamo", "italian"), "avamo");
    assert.equal(endingOf("cansadas", "spanish"), "adas");
  });

  test("an ending leaves at least two letters of stem", () => {
    // "amos" would leave none; the floor's three letters stand instead.
    assert.equal(endingOf("amos", "spanish"), "mos");
  });

  test(`a short ending, or none, gives the last ${ENDING_FLOOR} letters`, () => {
    assert.equal(endingOf("stanco", "italian"), "nco");
    assert.equal(endingOf("lehrer", "german"), "rer");
    assert.equal(endingOf("tu", "italian"), "tu");
  });
});

describe("keepsEnding", () => {
  test("both ways round: a longer ending of its own is another form", () => {
    assert.equal(keepsEnding("hablamos", "hablabamos", "spanish"), false);
    assert.equal(keepsEnding("hablabamos", "hablamos", "spanish"), false, "ends in -amos, but its ending is -abamos");
    assert.equal(keepsEnding("parlions", "parlons", "french"), false);
  });

  test("a slip in the stem keeps the ending", () => {
    assert.equal(keepsEnding("ristorrante", "ristorante", "italian"), true);
    assert.equal(keepsEnding("hablamso", "hablamos", "spanish"), false, "a slip inside the ending is not");
  });
});

test("known forms are the course's own words", () => {
  assert.equal(isKnownForm("comemos", "spanish"), true);
  assert.equal(isKnownForm("parliamno", "italian"), false);
  assert.equal(isKnownForm("comemos", "klingon"), false);
});
