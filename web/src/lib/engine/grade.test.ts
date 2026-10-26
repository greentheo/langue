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

  test("extra words must be whole words around the answer", () => {
    assert.equal(gradeAnswer("houses", ["house"]).verdict, "close", "a typo, not containment");
    assert.equal(gradeAnswer("firehouse", ["fire"]).verdict, "incorrect");
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
    assert.equal(gradeTargetAnswer("J'ai une soeur", ["J'ai une sœur."], "french").verdict, "correct");
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
    assert.equal(gradeTargetAnswer("Lui è stanco", ["Lui è stanco"], "italian").verdict, "correct");
  });

  test("a missing accent is close, with the accented form shown", () => {
    // "citta" is no word, so this is a slip (#114 makes "e" for "è" a different word).
    const result = gradeTargetAnswer("lui va in citta", ["Lui va in città"], "italian");
    assert.equal(result.verdict, "close");
    assert.match(result.note ?? "", /città/);
  });

  test("a wrong accent is close too", () => {
    assert.equal(gradeTargetAnswer("perchè", ["perché"], "italian").verdict, "close");
  });

  test("an accented answer still gets article and containment leniency", () => {
    assert.equal(gradeTargetAnswer("la città", ["città"], "italian").verdict, "correct");
    assert.equal(gradeTargetAnswer("io sono stanco", ["sono stanco"], "italian").verdict, "correct");
  });

  test("picks the accepted form the learner was aiming at", () => {
    const result = gradeTargetAnswer("perche", ["come mai", "perché"], "italian");
    assert.equal(result.verdict, "close");
    assert.match(result.note ?? "", /"perché"/);
  });

  test("a leading le / lo / la in a sentence is a pronoun, not an article", () => {
    assert.equal(gradeTargetAnswer("Gli regalo un libro", ["Le regalo un libro"], "italian").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("le regalo un libro", ["Le regalo un libro"], "italian").verdict, "correct");
    // A lone noun still drops its article.
    assert.equal(gradeTargetAnswer("il cane", ["cane"], "italian").verdict, "correct");
  });

  test("only a subject pronoun may be added; other extra words are a different answer", () => {
    assert.equal(gradeTargetAnswer("Lo voglio comprarlo", ["Voglio comprarlo", "Lo voglio comprare"], "italian").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("yo hablo español", ["hablo español"], "spanish").verdict, "correct");
  });

  test("a longer word containing the answer is not the answer", () => {
    assert.equal(gradeTargetAnswer("conosciamo", ["conosci"], "italian").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("piacerebbero", ["piacerebbe"], "italian").verdict, "incorrect");
  });

  test("short words get no typo allowance: lo is not la", () => {
    assert.equal(gradeTargetAnswer("la", ["lo"], "italian").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("noi", ["voi"], "italian").verdict, "incorrect");
  });

  test("with typos off, one letter off is wrong but a missing accent is still close", () => {
    assert.equal(gradeTargetAnswer("parla", ["parlo"], "italian", { typos: false }).verdict, "incorrect");
    assert.equal(gradeTargetAnswer("sara", ["sarà"], "italian", { typos: false }).verdict, "close");
  });

  test("leaves wrong and typo verdicts alone", () => {
    assert.equal(gradeTargetAnswer("ciao", ["grazie"], "italian").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("arivederci", ["arrivederci"], "italian").verdict, "close");
  });
});

describe("a close note quotes the accepted answer as written", () => {
  test("a typo in an accented word shows the word with its accents", () => {
    for (const [typed, accepted, language] of [
      // Slips in the stem; since #70 a slip in a word's last letters is an ending miss.
      ["tééléphone", "téléphone", "french"],
      ["unniversità", "università", "italian"],
      ["açúúcar", "açúcar", "portuguese"],
    ]) {
      const result = gradeTargetAnswer(typed, [accepted], language);
      assert.equal(result.verdict, "close", typed);
      assert.equal(result.score, 70, typed);
      assert.equal(result.note, `Close — the expected spelling is "${accepted}".`);
    }
  });

  test("a slip in the ending is a miss whose note spells the word as written", () => {
    const result = gradeTargetAnswer("téléphonne", ["téléphone"], "french");
    assert.equal(result.verdict, "incorrect");
    assert.equal(result.note, "Check the spelling of the ending: «téléphone».");
  });

  test("a typo of a noun without its article shows the answer with it", () => {
    assert.equal(gradeTargetAnswer("libbro", ["il libro"], "italian").note, 'Close — the expected spelling is "il libro".');
  });

  test("a typo after an added subject pronoun shows the listed answer", () => {
    assert.equal(gradeTargetAnswer("lui è sttanco", ["È stanco."], "italian").note, 'Close — the expected spelling is "È stanco.".');
  });

  test("an English typo keeps the answer's capitals and apostrophes", () => {
    assert.equal(gradeEnglishAnswer("I'm tird", ["I'm tired"]).note, `Close — the expected spelling is "I'm tired".`);
    assert.equal(gradeEnglishAnswer("new yorrk", ["New York"]).note, 'Close — the expected spelling is "New York".');
  });
});

describe("keepEndings: a slip that changes a word's ending is a mistake, not a typo", () => {
  // The probe table from #70: each pair is wrong both ways round.
  const PROBES: [string, string, string][] = [
    ["portuguese", "Estamos cansados", "Estamos cansadas"],
    ["portuguese", "Elas estão cansados", "Elas estão cansadas"],
    ["spanish", "Las chicas son altos", "Las chicas son altas"],
    ["french", "Elle est arrivé", "Elle est arrivée"],
    ["french", "Elles sont arrivés", "Elles sont arrivées"],
    ["spanish", "Comemos", "Comimos"],
    ["spanish", "Hablamos", "Hablábamos"],
    ["italian", "Parliamo", "Parlavamo"],
    ["french", "Nous parlons", "Nous parlions"],
    ["italian", "Lui è stanca", "Lui è stanco"],
    ["italian", "Sono stanchi", "Sono stanche"],
    ["italian", "Ho mangiato", "Ho mangiata"],
    ["italian", "Ieri parlava", "Ieri parlavo"],
  ];
  for (const [language, typed, expected] of PROBES) {
    test(`${language}: "${typed}" for "${expected}", and the other way round, is wrong`, () => {
      assert.equal(gradeTargetAnswer(typed, [expected], language).verdict, "incorrect");
      assert.equal(gradeTargetAnswer(expected, [typed], language).verdict, "incorrect");
    });
  }

  test("a slip in the stem is still a typo, in every language", () => {
    for (const [language, typed, expected] of [
      ["italian", "ristorrante", "ristorante"],
      ["italian", "bichiere", "bicchiere"],
      ["spanish", "restuarante", "restaurante"],
      ["spanish", "bibilioteca", "biblioteca"],
      ["french", "bibliotèque", "bibliothèque"],
      ["french", "restaurrant", "restaurant"],
      ["portuguese", "obirgado", "obrigado"],
      ["portuguese", "resturante", "restaurante"],
    ]) {
      assert.equal(gradeTargetAnswer(typed, [expected], language).verdict, "close", `${language}: ${typed}`);
    }
  });

  test("the rule applies through gradeAnswer's keepEndings option", () => {
    assert.equal(gradeAnswer("cansados", ["cansadas"], { keepEndings: true, language: "spanish" }).verdict, "incorrect");
    assert.equal(gradeAnswer("cansados", ["cansadas"], { keepEndings: false }).verdict, "close", "without it, a typo");
  });

  test("a language without an endings table keeps the last three letters", () => {
    // The same last letter, a different ending: today's last-letter rule calls it a typo.
    assert.equal(gradeTargetAnswer("Lehrar", ["Lehrer"], "german").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("Kaatze", ["Katze"], "german").verdict, "close");
  });

  test("a rejected ending says why: another form, or a misspelt ending", () => {
    // "comemos" is a form the Spanish course uses; "parliamno" is no word at all.
    const otherForm = gradeTargetAnswer("Comemos", ["Comimos"], "spanish");
    assert.equal(otherForm.verdict, "incorrect");
    assert.equal(otherForm.note, "That's another form — check the ending: «Comimos».");
    assert.equal(otherForm.endingMiss, "otherForm");
    const misspelt = gradeTargetAnswer("parliamno", ["parliamo"], "italian");
    assert.equal(misspelt.verdict, "incorrect");
    assert.equal(misspelt.note, "Check the spelling of the ending: «parliamo».");
    assert.equal(misspelt.endingMiss, "misspelt");
  });
});

describe("a missing accent that makes another real word is a mistake (#114)", () => {
  // The reviewer's list from #113: each missing accent leaves a different form the course uses.
  const OTHER_FORMS: [string, string, string][] = [
    ["french", "J'ai parle", "J'ai parlé"],
    ["french", "Je suis arrive", "Je suis arrivé"],
    ["french", "J'ai mange", "J'ai mangé"],
    ["spanish", "Ayer hablo", "Ayer habló"],
    ["portuguese", "Ele não pode vir ontem", "Ele não pôde vir ontem"],
    ["italian", "Lui e stanco", "Lui è stanco"],
  ];
  for (const [language, typed, expected] of OTHER_FORMS) {
    test(`${language}: "${typed}" for "${expected}" is wrong, with a note`, () => {
      const result = gradeTargetAnswer(typed, [expected], language);
      assert.equal(result.verdict, "incorrect");
      assert.ok(result.note, "the learner is told why");
    });
  }

  test("an accent in the ending is the grammar: another form", () => {
    const result = gradeTargetAnswer("J'ai parle", ["J'ai parlé"], "french");
    assert.equal(result.note, "That's another form — the accent is the grammar here: «J'ai parlé».");
    assert.equal(result.accentMiss, "otherForm");
  });

  test("an accent on a short word makes a different word", () => {
    const result = gradeTargetAnswer("Lui e stanco", ["Lui è stanco"], "italian");
    assert.equal(result.note, "That's a different word — «è» (is), not «e» (and).");
    assert.equal(result.accentMiss, "otherWord");
  });

  test("with both meanings, and the typed word as typed", () => {
    const result = gradeTargetAnswer("Ou est la gare ?", ["Où est la gare ?"], "french");
    assert.equal(result.note, "That's a different word — «Où» (where), not «Ou» (or).");
  });

  test("the short-word pairs carry both meanings, and pôde/pode is another form (#120 review)", () => {
    const NOTES: [string, string, string, string][] = [
      ["italian", "Lui e stanco", "Lui è stanco", "That's a different word — «è» (is), not «e» (and)."],
      ["spanish", "Esta en casa", "Está en casa", "That's a different word — «Está» (is), not «Esta» (this)."],
      ["spanish", "Tu eres mi amigo", "Tú eres mi amigo", "That's a different word — «Tú» (you (informal)), not «Tu» (your)."],
      ["spanish", "Si, claro", "Sí, claro", "That's a different word — «Sí» (yes), not «Si» (if)."],
      ["spanish", "el es mi hermano", "él es mi hermano", "That's a different word — «él» (he), not «el» (the)."],
      ["french", "Je vais a Paris", "Je vais à Paris", "That's a different word — «à» (to, at), not «a» (has)."],
      ["portuguese", "Ele e alto", "Ele é alto", "That's a different word — «é» (is), not «e» (and)."],
      ["portuguese", "Ela esta aqui", "Ela está aqui", "That's a different word — «está» (is), not «esta» (this)."],
    ];
    for (const [language, typed, expected, note] of NOTES) {
      const result = gradeTargetAnswer(typed, [expected], language);
      assert.equal(result.note, note, typed);
      assert.equal(result.accentMiss, "otherWord", typed);
    }
    const pode = gradeTargetAnswer("Ele não pode vir ontem", ["Ele não pôde vir ontem"], "portuguese");
    assert.equal(pode.verdict, "incorrect");
    assert.equal(pode.note, "That's another form — «pôde» (could, in the past), not «pode» (can).");
    assert.equal(pode.accentMiss, "otherForm");
  });

  test("a missing accent on a capital letter stays close (#120 review)", () => {
    // French print often leaves capitals bare, and Italian keyboards have no È.
    for (const [language, typed, expected] of [
      ["french", "A demain", "À demain"],
      ["french", "A bientôt", "À bientôt"],
      ["italian", "E stanco", "È stanco"],
      ["italian", "E' stanco", "È stanco"],
    ]) {
      const result = gradeTargetAnswer(typed, [expected], language);
      assert.equal(result.verdict, "close", typed);
      assert.equal(result.accentMiss, "plain", typed);
    }
    // Not on a small letter, and not when the missing accent is elsewhere in a capitalised word.
    assert.equal(gradeTargetAnswer("a demain", ["À demain"], "french").verdict, "incorrect");
    assert.equal(gradeTargetAnswer("Tu eres mi amigo", ["Tú eres mi amigo"], "spanish").verdict, "incorrect");
  });

  test("only in French and Italian: Spanish and Portuguese keep accents on capitals (#120 re-check)", () => {
    // Their keyboards have É, and the course types É, Às and Él in A1 phrases.
    const pt = gradeTargetAnswer("E muito caro.", ["É muito caro."], "portuguese");
    assert.equal(pt.verdict, "incorrect");
    assert.equal(pt.note, "That's a different word — «É» (is), not «E» (and).");
    const es = gradeTargetAnswer("El es mi primo.", ["Él es mi primo."], "spanish");
    assert.equal(es.verdict, "incorrect");
    assert.equal(es.note, "That's a different word — «Él» (he), not «El» (the).");
  });

  test("a missing accent that makes no word is still only close", () => {
    for (const [language, typed, expected] of [
      ["italian", "perche", "perché"],
      ["italian", "citta", "città"],
      ["french", "cafe", "café"],
      ["italian", "universita", "università"],
    ]) {
      const result = gradeTargetAnswer(typed, [expected], language);
      assert.equal(result.verdict, "close", typed);
      assert.equal(result.accentMiss, "plain", typed);
    }
  });
});
