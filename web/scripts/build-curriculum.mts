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
  DialoguesFileSchema,
  LessonFileSchema,
  LevelFileSchema,
  PhrasesFileSchema,
} from "../src/lib/curriculum/schema.js";
import { normalizeKeepingAccents } from "../src/lib/engine/grade.js";
import type {
  CurriculumCatalog,
  Dialogue,
  Lesson,
  LevelCurriculum,
  LevelOverview,
  Situation,
  Unit,
} from "../src/lib/curriculum/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..");
const CURRICULUM_DIR = join(REPO_ROOT, "data", "curriculum");
const VOCAB_DIR = join(REPO_ROOT, "data", "flashcard_libraries");
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

      // The guided path teaches a section, then asks its questions, so each
      // question must point at a real section and each section needs one.
      const perSection = file.sections.map(() => 0);
      file.practice.forEach((item, index) => {
        if (item.section > file.sections.length) {
          errors.push(
            `${where(join(lessonsDir, name))}: practice.${index}: section ${item.section} does not exist (the lesson has ${file.sections.length})`,
          );
        } else {
          perSection[item.section - 1] += 1;
        }
      });
      perSection.forEach((count, index) => {
        if (count === 0) {
          errors.push(
            `${where(join(lessonsDir, name))}: section ${index + 1} ("${file.sections[index].heading}") has no practice questions`,
          );
        }
      });

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
  let unitFiles: NonNullable<z.infer<typeof LevelFileSchema>["units"]> = [];
  const levelPath = join(dir, "level.yaml");
  if (existsSync(levelPath)) {
    const file = await load(levelPath, LevelFileSchema);
    if (file) {
      unitFiles = file.units ?? [];
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

  const units = await buildUnits(language, level, levelPath, unitFiles, lessons, situations);
  const dialogues = await buildDialogues(language, level, join(dir, "dialogues.yaml"), units);

  if (!overview && lessons.length === 0 && situations.length === 0) return null;
  return { overview, lessons, situations, units, dialogues };
}

/**
 * A level's role-plays. Each belongs to one of the level's units, has at
 * least two turns for the learner, and shows a concrete model answer (no
 * `*`) after each turn. Two turns with the same model answer would make the
 * pick-a-reply version of the dialogue unanswerable.
 */
async function buildDialogues(
  language: string,
  level: string,
  path: string,
  units: Unit[],
): Promise<Dialogue[]> {
  if (!existsSync(path)) return [];
  const file = await load(path, DialoguesFileSchema);
  if (!file) return [];

  if (units.length === 0) {
    errors.push(`${where(path)}: dialogues need the level's units (level.yaml) to belong to`);
    return [];
  }

  const seen = new Set<string>();
  return file.dialogues.map((dialogue, index) => {
    const at = `${where(path)}: dialogues.${index} ("${dialogue.id}")`;
    if (seen.has(dialogue.id)) errors.push(`${at}: id is used twice`);
    seen.add(dialogue.id);

    if (dialogue.unit > units.length) {
      errors.push(`${at}: unit ${dialogue.unit} does not exist (the level has ${units.length})`);
    }

    const turns = dialogue.lines.filter((line) => "you" in line);
    if (turns.length < 2) errors.push(`${at}: needs at least two "you" turns`);

    const models = new Set<string>();
    dialogue.lines.forEach((line, lineIndex) => {
      if (!("you" in line)) return;
      const [model, ...others] = line.answers;
      if (model.includes("*")) {
        errors.push(`${at}: lines.${lineIndex}: the first answer is shown to learners, so it cannot contain *`);
      }
      const normalized = normalizeKeepingAccents(model);
      if (models.has(normalized)) {
        errors.push(`${at}: lines.${lineIndex}: two turns have the same first answer "${model}"`);
      }
      models.add(normalized);

      const forms = new Set([normalized]);
      for (const answer of others) {
        const form = normalizeKeepingAccents(answer);
        if (forms.has(form)) errors.push(`${at}: lines.${lineIndex}: "${answer}" is listed twice`);
        forms.add(form);
      }
    });

    return {
      id: `${language}-${level}-${dialogue.id}`,
      language,
      level,
      unit: dialogue.unit,
      title: dialogue.title,
      setting: dialogue.setting,
      with: dialogue.with,
      lines: dialogue.lines,
    };
  });
}

/** Vocabulary-library categories at a level, from the JSON the vocab build reads. */
async function libraryCategories(language: string, level: string): Promise<Set<string>> {
  const path = join(VOCAB_DIR, language, `${level}.json`);
  if (!existsSync(path)) return new Set();
  const library = JSON.parse(await readFile(path, "utf8")) as { words?: { category?: string }[] };
  return new Set((library.words ?? []).map((word) => word.category ?? "").filter(Boolean));
}

/**
 * Resolve a level's units and check they partition it: every lesson,
 * situation and vocabulary category belongs to exactly one unit, and lessons
 * stay in number order (a lesson's practice may use earlier lessons).
 */
async function buildUnits(
  language: string,
  level: string,
  levelPath: string,
  unitFiles: NonNullable<z.infer<typeof LevelFileSchema>["units"]>,
  lessons: Lesson[],
  situations: Situation[],
): Promise<Unit[]> {
  if (unitFiles.length === 0) return [];

  const lessonBySlug = new Map(lessons.map((lesson) => [lesson.slug, lesson]));
  const situationIds = new Set(situations.map((situation) => situation.id));
  const categories = await libraryCategories(language, level);

  const claimed = { lessons: new Map<string, number>(), situations: new Map<string, number>(), categories: new Map<string, number>() };
  const claim = (kind: keyof typeof claimed, key: string, unit: number) => {
    const previous = claimed[kind].get(key);
    if (previous !== undefined) {
      const noun = { lessons: "lesson", situations: "situation", categories: "category" }[kind];
      errors.push(`${where(levelPath)}: ${noun} "${key}" is in both unit ${previous} and unit ${unit}`);
    }
    claimed[kind].set(key, unit);
  };

  let lastLessonNumber = 0;
  const units = unitFiles.map((file, index): Unit => {
    const number = index + 1;
    if (file.lessons.length + file.situations.length + file.categories.length === 0) {
      errors.push(`${where(levelPath)}: unit ${number} ("${file.title}") is empty`);
    }

    for (const slug of file.lessons) {
      claim("lessons", slug, number);
      const lesson = lessonBySlug.get(slug);
      if (!lesson) {
        errors.push(`${where(levelPath)}: unit ${number} names missing lesson "${slug}"`);
        continue;
      }
      if (lesson.number < lastLessonNumber) {
        errors.push(`${where(levelPath)}: unit ${number} puts lesson "${slug}" after a later lesson`);
      }
      lastLessonNumber = lesson.number;
    }
    for (const id of file.situations) {
      claim("situations", id, number);
      if (!situationIds.has(id)) {
        errors.push(`${where(levelPath)}: unit ${number} names missing phrasebook situation "${id}"`);
      }
    }
    for (const category of file.categories) {
      claim("categories", category, number);
      if (!categories.has(category)) {
        errors.push(`${where(levelPath)}: unit ${number} names vocabulary category "${category}", which the ${level} library does not have`);
      }
    }

    return {
      id: `${language}-${level}-${number}`,
      language,
      level,
      number,
      title: file.title,
      lessonIds: file.lessons.map((slug) => `${language}-${level}-${slug}`),
      situationIds: file.situations,
      categories: file.categories,
    };
  });

  for (const lesson of lessons) {
    if (!claimed.lessons.has(lesson.slug)) errors.push(`${where(levelPath)}: lesson "${lesson.slug}" is in no unit`);
  }
  for (const id of situationIds) {
    if (!claimed.situations.has(id)) errors.push(`${where(levelPath)}: phrasebook situation "${id}" is in no unit`);
  }
  for (const category of categories) {
    if (!claimed.categories.has(category)) errors.push(`${where(levelPath)}: vocabulary category "${category}" is in no unit`);
  }

  return units;
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
        const dialogues = built.dialogues.length > 0 ? `, ${built.dialogues.length} dialogues` : "";
        summary.push(`${language}/${level}: ${built.lessons.length} lessons, ${phraseCount} phrases${dialogues}`);
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
