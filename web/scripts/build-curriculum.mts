#!/usr/bin/env node
/**
 * Compile data/curriculum into src/lib/curriculum/generated.ts.
 *
 * Same reasoning as build-vocab.mjs: lessons become ordinary typed code at
 * build time, so a lesson page never reads YAML off disk and a malformed file
 * is a build failure rather than a broken page. Every file is validated
 * against src/lib/curriculum/schema.ts, and cross-references (grammar topics
 * pointing at lesson slugs) are checked.
 *
 *   tsx scripts/build-curriculum.mts            # validate and write
 *   tsx scripts/build-curriculum.mts --check    # validate only
 *   tsx scripts/build-curriculum.mts --check --language italian
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import {
  LessonFileSchema,
  LevelFileSchema,
  PhrasesFileSchema,
} from "../src/lib/curriculum/schema.js";
import type {
  CurriculumCatalog,
  Lesson,
  LevelCurriculum,
  LevelOverview,
  Situation,
} from "../src/lib/curriculum/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..");
const CURRICULUM_DIR = join(REPO_ROOT, "data", "curriculum");
const OUT_FILE = join(WEB_ROOT, "src", "lib", "curriculum", "generated.ts");

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
const LESSON_FILE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.ya?ml$/;

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const onlyLanguage = args.includes("--language") ? args[args.indexOf("--language") + 1] : null;

const errors: string[] = [];

function where(path: string): string {
  return relative(REPO_ROOT, path);
}

async function load<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S> | null> {
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(path, "utf8"), { uniqueKeys: true, prettyErrors: true });
  } catch (error) {
    errors.push(`${where(path)}: YAML error: ${(error as Error).message}`);
    return null;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${where(path)}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return null;
  }
  return parsed.data;
}

async function buildLevel(language: string, level: string, dir: string): Promise<LevelCurriculum | null> {
  const lessons: Lesson[] = [];
  const lessonsDir = join(dir, "lessons");

  if (existsSync(lessonsDir)) {
    const files = (await readdir(lessonsDir)).filter((name) => /\.ya?ml$/.test(name)).sort();
    const seenNumbers = new Set<number>();

    for (const name of files) {
      const match = LESSON_FILE.exec(name);
      if (!match) {
        errors.push(`${where(join(lessonsDir, name))}: lesson files are named NN-slug.yaml`);
        continue;
      }

      const number = Number(match[1]);
      if (seenNumbers.has(number)) {
        errors.push(`${where(join(lessonsDir, name))}: lesson number ${number} is used twice`);
      }
      seenNumbers.add(number);

      const file = await load(join(lessonsDir, name), LessonFileSchema);
      if (!file) continue;

      const slug = name.replace(/\.ya?ml$/, "");
      lessons.push({
        id: `${language}-${level}-${slug}`,
        slug,
        number,
        language,
        level,
        title: file.title,
        subtitle: file.subtitle ?? null,
        goal: file.goal,
        minutes: file.minutes,
        sections: file.sections,
        words: file.words,
        practice: file.practice,
      });
    }
  }

  let overview: LevelOverview | null = null;
  const levelPath = join(dir, "level.yaml");
  if (existsSync(levelPath)) {
    const file = await load(levelPath, LevelFileSchema);
    if (file) {
      const slugs = new Set(lessons.map((lesson) => lesson.slug));
      for (const topic of file.grammar) {
        for (const slug of topic.lessons) {
          if (!slugs.has(slug)) {
            errors.push(`${where(levelPath)}: grammar topic "${topic.topic}" names missing lesson "${slug}"`);
          }
        }
      }

      // The checklist is how learners see what a level covers, so every
      // lesson must appear in it.
      const referenced = new Set(file.grammar.flatMap((topic) => topic.lessons));
      for (const lesson of lessons) {
        if (!referenced.has(lesson.slug)) {
          errors.push(`${where(levelPath)}: lesson "${lesson.slug}" is not linked from any grammar topic`);
        }
      }

      overview = {
        language,
        level,
        title: file.title,
        summary: file.summary,
        canDo: file.can_do,
        grammar: file.grammar.map((topic) => ({
          topic: topic.topic,
          lessonIds: topic.lessons.map((slug) => `${language}-${level}-${slug}`),
        })),
        themes: file.themes,
      };
    }
  }

  const situations: Situation[] = [];
  const phrasesPath = join(dir, "phrases.yaml");
  if (existsSync(phrasesPath)) {
    const file = await load(phrasesPath, PhrasesFileSchema);
    if (file) {
      const seenSituations = new Set<string>();
      const seenTargets = new Map<string, string>();

      for (const situation of file.situations) {
        if (seenSituations.has(situation.id)) {
          errors.push(`${where(phrasesPath)}: situation id "${situation.id}" is used twice`);
        }
        seenSituations.add(situation.id);

        situations.push({
          id: situation.id,
          title: situation.title,
          phrases: situation.phrases.map((phrase, index) => {
            const key = phrase.target[0].toLowerCase();
            const previous = seenTargets.get(key);
            if (previous) {
              errors.push(
                `${where(phrasesPath)}: "${phrase.target[0]}" appears in both ${previous} and ${situation.id}`,
              );
            }
            seenTargets.set(key, situation.id);

            return {
              id: `${language}-${level}-${situation.id}-${index + 1}`,
              language,
              level,
              situationId: situation.id,
              target: phrase.target,
              english: phrase.english,
              display: phrase.display ?? phrase.target[0],
              note: phrase.note ?? null,
              literally: phrase.literally ?? null,
            };
          }),
        });
      }
    }
  }

  if (!overview && lessons.length === 0 && situations.length === 0) return null;
  return { overview, lessons, situations };
}

async function main() {
  if (!existsSync(CURRICULUM_DIR)) {
    console.error(`[build-curriculum] ${where(CURRICULUM_DIR)} not found.`);
    process.exit(1);
  }

  const languages = (await readdir(CURRICULUM_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((language) => !onlyLanguage || language === onlyLanguage)
    .sort();

  const catalog: CurriculumCatalog = {};
  const summary: string[] = [];

  for (const language of languages) {
    for (const level of LEVELS) {
      const dir = join(CURRICULUM_DIR, language, level);
      if (!existsSync(dir)) continue;

      const built = await buildLevel(language, level, dir);
      if (!built) continue;

      catalog[language] ??= {};
      catalog[language][level] = built;

      const phraseCount = built.situations.reduce((sum, s) => sum + s.phrases.length, 0);
      if (built.lessons.length > 0 || phraseCount > 0) {
        summary.push(`${language}/${level}: ${built.lessons.length} lessons, ${phraseCount} phrases`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`[build-curriculum] ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`[build-curriculum] ok :: ${summary.join(" · ") || "overviews only"}`);
  if (checkOnly) return;

  const output = `// GENERATED FILE — DO NOT EDIT.
//
// Built from data/curriculum by scripts/build-curriculum.mts. Edit the YAML
// there, then rebuild (npm run codegen).

import type { CurriculumCatalog } from "./types";

export const CURRICULUM: CurriculumCatalog = ${JSON.stringify(catalog, null, 2)};
`;

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, output, "utf8");
}

main().catch((error) => {
  console.error("[build-curriculum] failed:", error);
  process.exit(1);
});
