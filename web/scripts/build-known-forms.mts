/**
 * Generate src/lib/engine/known-forms.generated.ts: every target-language word
 * written in a language's course content, as the grader compares words.
 *
 * When a near miss is rejected because its ending is wrong (#70), the note says
 * "that's another form" if the typed word is a real form the course uses
 * (cansados for cansadas), and "check the spelling of the ending" if it isn't.
 * The list is the course's own words, so nothing about it is hand-kept.
 *
 * Reads the vocabulary and curriculum modules the earlier codegen steps wrote,
 * so it runs after them (npm run codegen).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRICULUM } from "../src/lib/curriculum/generated.js";
import { VOCAB_CATALOG } from "../src/lib/vocab/generated.js";
import { normalizeAnswer, normalizeKeepingAccents } from "../src/lib/engine/normalize.js";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(WEB_ROOT, "src", "lib", "engine", "known-forms.generated.ts");

/** Target-language text only: English glosses, notes and lesson prose would add English words. */
function targetTexts(language: string): string[] {
  const texts: string[] = [];
  for (const words of Object.values(VOCAB_CATALOG[language] ?? {})) {
    for (const entry of words ?? []) texts.push(entry.word, ...entry.examples);
  }
  for (const level of Object.values(CURRICULUM[language] ?? {})) {
    for (const lesson of level?.lessons ?? []) {
      texts.push(...lesson.words.map(([target]) => target));
      for (const section of lesson.sections) {
        texts.push(...(section.examples ?? []).map(([target]) => target));
        // Conjugation and agreement tables; their few English row labels are harmless.
        texts.push(...(section.table?.rows.flat() ?? []));
      }
      for (const item of lesson.practice) {
        if (item.type === "fill") texts.push(item.prompt.replace("___", " "), ...item.answers);
        if (item.type === "translate") texts.push(...(item.direction === "to-target" ? item.answers : [item.prompt]));
      }
    }
    for (const situation of level?.situations ?? []) {
      for (const phrase of situation.phrases) texts.push(...phrase.target);
    }
    for (const dialogue of level?.dialogues ?? []) {
      for (const line of dialogue.lines) {
        if ("them" in line) texts.push(line.them);
        else texts.push(...line.answers.map((answer) => answer.replace(/\*/g, " ")));
      }
    }
  }
  return texts;
}

/** What a single word means, from the lessons first, then the vocabulary: "è" → "is". */
function glosses(language: string): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (word: string, english: string | undefined) => {
    const key = normalizeKeepingAccents(word);
    if (english && key && !key.includes(" ") && !(key in out)) out[key] = english.split(/[;,]/)[0].trim();
  };
  for (const level of Object.values(CURRICULUM[language] ?? {})) {
    for (const lesson of level?.lessons ?? []) for (const [target, english] of lesson.words) add(target, english);
  }
  for (const words of Object.values(VOCAB_CATALOG[language] ?? {})) {
    for (const entry of words ?? []) add(entry.word, entry.translations[0]);
  }
  return out;
}

const languages = [...new Set([...Object.keys(VOCAB_CATALOG), ...Object.keys(CURRICULUM)])].sort();
const forms: Record<string, string> = {};
const written: Record<string, string> = {};
const meanings: Record<string, Record<string, string>> = {};
for (const language of languages) {
  const texts = targetTexts(language);
  const words = new Set(texts.flatMap((text) => normalizeAnswer(text).split(" ")).filter(Boolean));
  forms[language] = [...words].sort().join(" ");
  // The same words with their accents, so "parle" and "parlé" are two forms (#114).
  const withAccents = new Set(texts.flatMap((text) => normalizeKeepingAccents(text).split(" ")).filter(Boolean));
  written[language] = [...withAccents].sort().join(" ");
  meanings[language] = glosses(language);
}

const body = `// GENERATED FILE — DO NOT EDIT.
//
// Built by scripts/build-known-forms.mts from the vocabulary and curriculum
// (npm run codegen): each language's words, space-separated, as the grader
// compares them (KNOWN_FORMS, accents stripped) and as written (KNOWN_WRITTEN_FORMS,
// accents kept); and what single words mean (GLOSSES).

export const KNOWN_FORMS: Record<string, string> = ${JSON.stringify(forms, null, 2)};

export const KNOWN_WRITTEN_FORMS: Record<string, string> = ${JSON.stringify(written, null, 2)};

export const GLOSSES: Record<string, Record<string, string>> = ${JSON.stringify(meanings)};
`;
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, body);
console.log(
  `[build-known-forms] ${languages.map((language) => `${language} ${forms[language].split(" ").length}`).join(" · ")} words -> ${OUT_FILE.slice(WEB_ROOT.length + 1)}`,
);
