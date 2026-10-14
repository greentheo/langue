import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { blankOut, buildable, gradeReply, sameSentence, tilesOf } from "./sentences";

describe("sentence tiles", () => {
  test("words keep their apostrophes; punctuation and a lone dash go", () => {
    assert.deepEqual(tilesOf("Di dove sei? — Sono di Chicago."), ["Di", "dove", "sei", "Sono", "di", "Chicago"]);
    assert.deepEqual(tilesOf("¿Dónde está l'acqua?"), ["Dónde", "está", "l'acqua"]);
    assert.deepEqual(tilesOf("J'ai faim !"), ["J'ai", "faim"]);
  });

  test("one word, or a whole paragraph, is not a sentence to build", () => {
    assert.equal(buildable("Ciao!"), false);
    assert.equal(buildable("Ciao, come stai?"), true);
    assert.equal(buildable("uno due tre quattro cinque sei sette otto nove dieci undici"), false);
  });

  test("tiles in order make the sentence, whatever the capitals and punctuation", () => {
    assert.ok(sameSentence("sono di roma", "Sono di Roma."));
    assert.ok(!sameSentence("di sono Roma", "Sono di Roma."));
    // Accents are part of the word: è is not e.
    assert.ok(!sameSentence("lei e giulia", "Lei è Giulia."));
  });
});

describe("blanking a word out", () => {
  test("the first whole-word match, as written in the sentence", () => {
    assert.deepEqual(blankOut("Sono molto stanco oggi.", ["stanco"]), {
      before: "Sono molto ",
      answer: "stanco",
      after: " oggi.",
    });
    assert.equal(blankOut("Buongiorno!", ["giorno"]), null, "not part of a word");
    assert.equal(blankOut("L'acqua è fredda.", ["acqua"]), null, "not after an apostrophe");
    assert.equal(blankOut("Ciao, come stai?", ["Ciao"])?.answer, "Ciao");
    assert.equal(blankOut("ciao", ["CIAO"])?.answer, "ciao", "any case");
  });

  test("longer forms first, so a phrase beats a word inside it", () => {
    assert.equal(blankOut("Parlo un po' italiano.", ["po", "un po'"])?.answer, "un po'");
  });
});

describe("role-play replies", () => {
  const accepted = ["Mi chiamo Anna.", "Mi chiamo *.", "Sono *."];

  test("a listed reply, with the usual leniency", () => {
    assert.equal(gradeReply("mi chiamo anna", accepted).verdict, "correct");
    assert.equal(gradeReply("Mi chimo Anna", accepted).verdict, "close");
  });

  test("* stands for any name", () => {
    assert.equal(gradeReply("Mi chiamo Theo!", accepted).verdict, "correct");
    assert.equal(gradeReply("Sono Giulia", accepted).verdict, "correct");
    assert.equal(gradeReply("Ciao, mi chiamo Sam", accepted).verdict, "correct", "a greeting first is fine");
    assert.equal(gradeReply("Sì, bene, grazie", ["Bene, grazie."]).verdict, "correct", "a little more than listed");
    assert.equal(gradeReply("Mi chiamo", accepted).verdict, "incorrect", "the name is needed");
    assert.equal(gradeReply("Buongiorno", accepted).verdict, "incorrect");
  });
});
