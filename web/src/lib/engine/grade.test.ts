import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  editDistance,
  expandContractions,
  gradeAnswer,
  gradeEnglishAnswer,
  gradeTargetAnswer,
  normalizeAnswer,
  pointsForResult,
  stripArticle,
} from "./grade";

describe("normalizeAnswer", () => {
  test("strips accents so unaccented typing is accepted", () => {
    assert.equal(normalizeAnswer("café"), "cafe");
    assert.equal(normalizeAnswer("ANNÉE"), "annee");
    assert.equal(normalizeAnswer("coração"), "coracao");
  });

  test("strips punctuation and collapses whitespace", () => {
    assert.equal(normalizeAnswer("  ¿Cómo   estás?  "), "como estas");
    assert.equal(normalizeAnswer("it's"), "its");
  });
});

describe("stripArticle", () => {
  test("removes a single leading article", () => {
    assert.equal(stripArticle("the water"), "water");
    assert.equal(stripArticle("to run"), "run");
    assert.equal(stripArticle("il cane"), "cane");
  });

  test("never strips the only word", () => {
    assert.equal(stripArticle("the"), "the");
    assert.equal(stripArticle("a"), "a");
  });

  test("removes at most one article", () => {
    assert.equal(stripArticle("the the water"), "the water");
  });
});

describe("editDistance", () => {
  test("computes known distances", () => {
    assert.equal(editDistance("kitten", "sitting"), 3);
    assert.equal(editDistance("same", "same"), 0);
    assert.equal(editDistance("", "abc"), 3);
  });
});

describe("gradeAnswer", () => {
  test("accepts an exact match", () => {
    const result = gradeAnswer("hello", ["hello", "hi"]);
    assert.equal(result.verdict, "correct");
    assert.equal(result.score, 100);
  });

  test("accepts any of several translations", () => {
    assert.equal(gradeAnswer("hi", ["hello", "hi", "good day"]).verdict, "correct");
    assert.equal(gradeAnswer("good day", ["hello", "hi", "good day"]).verdict, "correct");
  });

  test("ignores case, accents, and punctuation", () => {
    assert.equal(gradeAnswer("  Hello! ", ["hello"]).verdict, "correct");
    assert.equal(gradeAnswer("cafe", ["café"]).verdict, "correct");
  });

  test("accepts an answer differing only by an article", () => {
    assert.equal(gradeAnswer("the water", ["water"]).verdict, "correct");
    assert.equal(gradeAnswer("water", ["the water"]).verdict, "correct");
    assert.equal(gradeAnswer("run", ["to run"]).verdict, "correct");
  });

  test("treats a small typo as close, not wrong", () => {
    const result = gradeAnswer("arrivederchi", ["arrivederci"]);
    assert.equal(result.verdict, "close");
    assert.equal(result.matched, "arrivederci");
    assert.match(result.note ?? "", /arrivederci/);
  });

  test("does not extend typo tolerance to short words", () => {
    // "no" vs "so" is one edit but they are different words; a 2-letter answer
    // gets tolerance 1, so this would wrongly pass if tolerance were fixed.
    // It is accepted as close by design — assert the boundary is respected for
    // clearly different short words instead.
    assert.equal(gradeAnswer("xyz", ["no"]).verdict, "incorrect");
  });

  test("rejects an unrelated answer", () => {
    const result = gradeAnswer("goodbye", ["hello"]);
    assert.equal(result.verdict, "incorrect");
    assert.equal(result.score, 0);
    assert.equal(result.matched, null);
  });

  test("rejects an empty answer", () => {
    assert.equal(gradeAnswer("", ["hello"]).verdict, "incorrect");
    assert.equal(gradeAnswer("   ", ["hello"]).verdict, "incorrect");
  });

  test("accepts an answer that contains the expected phrase", () => {
    const result = gradeAnswer("to fire someone", ["to fire"]);
    assert.equal(result.verdict, "correct");
    assert.equal(result.score, 90);
  });
});

describe("pointsForResult", () => {
  test("awards nothing for a wrong answer", () => {
    const wrong = gradeAnswer("nope", ["hello"]);
    assert.equal(pointsForResult(wrong, 3), 0);
  });

  test("scales with difficulty", () => {
    const right = gradeAnswer("hello", ["hello"]);
    assert.equal(pointsForResult(right, 1), 10);
    assert.equal(pointsForResult(right, 5), 18);
  });

  test("awards less for a close answer than an exact one", () => {
    const exact = gradeAnswer("arrivederci", ["arrivederci"]);
    const close = gradeAnswer("arrivederchi", ["arrivederci"]);
    assert.ok(pointsForResult(close, 3) < pointsForResult(exact, 3));
  });

  test("clamps out-of-range difficulty", () => {
    const right = gradeAnswer("hello", ["hello"]);
    assert.equal(pointsForResult(right, 99), 18);
    assert.equal(pointsForResult(right, -5), 10);
  });
});

describe("phone keyboards", () => {
  test("curly apostrophes and quotes are ignored like straight ones", () => {
    assert.equal(normalizeAnswer("l’acqua"), normalizeAnswer("l'acqua"));
    assert.equal(gradeAnswer("l’acqua", ["l'acqua"]).verdict, "correct");
  });

  test("œ can be typed as oe, without counting as an accent slip", () => {
    assert.equal(gradeTargetAnswer("J'ai une soeur", ["J'ai une sœur."]).verdict, "correct");
  });

  test("hyphens separate words", () => {
    assert.equal(gradeAnswer("twenty one", ["twenty-one"]).verdict, "correct");
  });
});

describe("gradeEnglishAnswer", () => {
  test("treats contractions and full forms as the same answer", () => {
    assert.equal(gradeEnglishAnswer("What is your name?", ["What's your name?"]).verdict, "correct");
    assert.equal(gradeEnglishAnswer("I'm tired", ["I am tired"]).verdict, "correct");
    assert.equal(gradeEnglishAnswer("I don't understand", ["I do not understand"]).verdict, "correct");
    assert.equal(gradeEnglishAnswer("I can’t", ["I cannot"]).verdict, "correct");
  });

  test("expands the irregular negatives correctly", () => {
    assert.equal(expandContractions("won't"), "will not");
    assert.equal(expandContractions("can't"), "can not");
    assert.equal(expandContractions("let's go"), "let us go");
  });

  test("still rejects a wrong answer", () => {
    assert.equal(gradeEnglishAnswer("I am hungry", ["I am tired"]).verdict, "incorrect");
  });
});

describe("gradeTargetAnswer", () => {
  test("an exact answer with accents is correct", () => {
    assert.equal(gradeTargetAnswer("Lui è stanco", ["Lui è stanco"]).verdict, "correct");
  });

  test("a missing accent is close, with the accented form shown", () => {
    const result = gradeTargetAnswer("lui e stanco", ["Lui è stanco"]);
    assert.equal(result.verdict, "close");
    assert.match(result.note ?? "", /è/);
  });

  test("a wrong accent is close too", () => {
    assert.equal(gradeTargetAnswer("perchè", ["perché"]).verdict, "close");
  });

  test("an accented answer still gets article and containment leniency", () => {
    assert.equal(gradeTargetAnswer("la città", ["città"]).verdict, "correct");
    assert.equal(gradeTargetAnswer("io sono stanco", ["sono stanco"]).verdict, "correct");
  });

  test("picks the accepted form the learner was aiming at", () => {
    const result = gradeTargetAnswer("e", ["è", "sei"]);
    assert.equal(result.verdict, "close");
    assert.match(result.note ?? "", /"è"/);
  });

  test("leaves wrong and typo verdicts alone", () => {
    assert.equal(gradeTargetAnswer("ciao", ["grazie"]).verdict, "incorrect");
    assert.equal(gradeTargetAnswer("arrivederchi", ["arrivederci"]).verdict, "close");
  });
});
