#!/usr/bin/env node
/**
 * Generate src/lib/vocab/generated.ts from the shared vocabulary libraries in
 * ../data/flashcard_libraries.
 *
 * The Python CLI and this web app read the same word lists. Rather than have
 * the server read JSON off disk at request time — which breaks the moment the
 * container image doesn't include ../data, and forces every vocab lookup to be
 * async — we compile the libraries into a plain TypeScript module at build
 * time. The bundler then treats vocabulary as ordinary code: typed, tree-shaken
 * where possible, and impossible to get a runtime ENOENT from.
 *
 * Run automatically via the `prebuild` and `predev` npm scripts.
 */

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..");
const LIBRARY_DIR = join(REPO_ROOT, "data", "flashcard_libraries");
const OUT_FILE = join(WEB_ROOT, "src", "lib", "vocab", "generated.ts");

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** Levels below this word count are too thin to run a session from. */
const MIN_USABLE_WORDS = 20;

async function main() {
  if (!existsSync(LIBRARY_DIR)) {
    console.error(
      `[build-vocab] Vocabulary libraries not found at ${LIBRARY_DIR}.\n` +
        `The web app is built from the repository root so it can read the ` +
        `shared data/ directory. If this is a Docker build, make sure the ` +
        `build context is the repo root and data/ is copied into the image.`,
    );
    process.exit(1);
  }

  const entries = await readdir(LIBRARY_DIR, { withFileTypes: true });
  const languages = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const catalog = {};
  let totalWords = 0;
  const skipped = [];

  for (const language of languages) {
    const levels = {};

    for (const level of LEVELS) {
      const path = join(LIBRARY_DIR, language, `${level}.json`);
      if (!existsSync(path)) continue;

      const parsed = JSON.parse(await readFile(path, "utf8"));
      const words = (parsed.words ?? []).map((word) => ({
        word: word.word,
        translations: word.translations ?? [],
        examples: word.examples ?? [],
        category: word.category ?? "basics",
        difficulty: word.difficulty ?? 1,
      }));

      if (words.length < MIN_USABLE_WORDS) {
        skipped.push(`${language}/${level} (${words.length} words)`);
        continue;
      }

      levels[level] = words;
      totalWords += words.length;
    }

    // A language with no usable level would render an empty picker entry.
    if (Object.keys(levels).length > 0) {
      catalog[language] = levels;
    } else {
      skipped.push(`${language} (no usable level)`);
    }
  }

  const header = `// GENERATED FILE — DO NOT EDIT.
//
// Built from data/flashcard_libraries by scripts/build-vocab.mjs.
// To change vocabulary, edit data/vocab_sources/<language>/<level>.psv in the
// repository root, run \`python -m langue.tools.vocab_build\`, then rebuild.

import type { VocabWord } from "./types";

export type VocabCatalog = Record<string, Partial<Record<string, VocabWord[]>>>;

export const VOCAB_CATALOG: VocabCatalog = ${JSON.stringify(catalog, null, 2)};
`;

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, header, "utf8");

  const languageSummary = Object.entries(catalog)
    .map(([lang, levels]) => `${lang}(${Object.keys(levels).length})`)
    .join(" ");

  console.log(
    `[build-vocab] ${totalWords} words -> src/lib/vocab/generated.ts :: ${languageSummary}`,
  );
  if (skipped.length > 0) {
    console.log(`[build-vocab] skipped as too thin: ${skipped.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("[build-vocab] failed:", error);
  process.exit(1);
});
