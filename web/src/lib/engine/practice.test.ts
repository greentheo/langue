import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { difficultyForLevel, gradePracticeItem } from "./practice";
import type { PracticeItem } from "@/lib/curriculum/schema";

const fill: PracticeItem = {
  type: "fill",
  section: 1,
  prompt: "Lui ___ stanco.",
  hint: "essere",
  answers: ["è"],
  why: "Lui takes è.",
};

const toEnglish: PracticeItem = {
  type: "translate",
  section: 1,
  direction: "to-english",
  prompt: "Come ti chiami?",
  answers: ["What's your name?"],
  why: "Chiamarsi means to be called.",
};

const toTarget: PracticeItem = {
  type: "translate",
  section: 1,
  direction: "to-target",
  prompt: "I am tired (a woman speaking)",
  answers: ["Sono stanca.", "Io sono stanca."],
  why: "Stanca agrees with a female speaker.",
};

const choice: PracticeItem = {
  type: "choice",
  section: 1,
  prompt: "Which article does *zaino* take?",
  options: ["il", "lo"],
  answer: "lo",
  why: "Z takes lo.",
};

const cedilla: PracticeItem = {
  type: "fill",
  section: 1,
  prompt: "gar___on",
  hint: "c or ç?",
  answers: ["ç"],
  why: "Before o, c needs a cédille to sound like s.",
  strict_accents: true,
};

describe("gradePracticeItem", () => {
  test("strict_accents items mark a missing accent wrong, not close", () => {
    assert.equal(gradePracticeItem(cedilla, "c", "a1").verdict, "incorrect");
    assert.equal(gradePracticeItem(cedilla, "ç", "a1").verdict, "correct");
  });

  test("a fill answer missing its accent is close and shows the accented form", () => {
    const grade = gradePracticeItem(fill, "e", "a1");
    assert.equal(grade.verdict, "close");
    assert.match(grade.note ?? "", /è/);
    assert.equal(grade.why, "Lui takes è.");
  });

  test("English answers accept full forms for contractions", () => {
    assert.equal(gradePracticeItem(toEnglish, "what is your name", "a1").verdict, "correct");
  });

  test("target answers accept any listed variant and reveal them all", () => {
    const grade = gradePracticeItem(toTarget, "io sono stanca", "a1");
    assert.equal(grade.verdict, "correct");
    assert.deepEqual(grade.answers, ["Sono stanca.", "Io sono stanca."]);
  });

  test("a choice compares capitals and accents exactly", () => {
    const spelling: PracticeItem = {
      type: "choice",
      section: 1,
      prompt: "Which is spelled correctly?",
      options: ["Lunedì", "lunedì", "lunedi"],
      answer: "lunedì",
      why: "Days of the week are lowercase in Italian.",
    };
    assert.equal(gradePracticeItem(spelling, "Lunedì", "a1").verdict, "incorrect");
    assert.equal(gradePracticeItem(spelling, "lunedi", "a1").verdict, "incorrect");
    assert.equal(gradePracticeItem(spelling, "lunedì", "a1").verdict, "correct");
  });

  test("a choice is right only on the exact option", () => {
    assert.equal(gradePracticeItem(choice, "lo", "a1").verdict, "correct");
    assert.equal(gradePracticeItem(choice, "il", "a1").verdict, "incorrect");
    assert.equal(gradePracticeItem(choice, "il", "a1").points, 0);
  });

  test("points grow with level", () => {
    const a1 = gradePracticeItem(choice, "lo", "a1").points;
    const b2 = gradePracticeItem(choice, "lo", "b2").points;
    assert.ok(b2 > a1);
    assert.equal(difficultyForLevel("nonsense"), 1);
  });
});
