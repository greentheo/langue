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
import { normalizeAnswer } from "../src/lib/engine/normalize.js";

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

const languages = [...new Set([...Object.keys(VOCAB_CATALOG), ...Object.keys(CURRICULUM)])].sort();
const forms: Record<string, string> = {};
for (const language of languages) {
  const words = new Set(targetTexts(language).flatMap((text) => normalizeAnswer(text).split(" ")).filter(Boolean));
  forms[language] = [...words].sort().join(" ");
}

const body = `// GENERATED FILE — DO NOT EDIT.
//
// Built by scripts/build-known-forms.mts from the vocabulary and curriculum
// (npm run codegen): each language's words, normalized, space-separated.

export const KNOWN_FORMS: Record<string, string> = ${JSON.stringify(forms, null, 2)};
`;
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, body);
console.log(
  `[build-known-forms] ${languages.map((language) => `${language} ${forms[language].split(" ").length}`).join(" · ")} words -> ${OUT_FILE.slice(WEB_ROOT.length + 1)}`,
);
