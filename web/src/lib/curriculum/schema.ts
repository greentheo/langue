/**
 * Curriculum content schema.
 *
 * Lessons, phrases and level overviews are authored as YAML under
 * data/curriculum/<language>/<level>/ and compiled into generated.ts by
 * scripts/build-curriculum.mts. These schemas are the contract between the
 * two: the build validates every file against them, so a malformed lesson
 * fails the build instead of rendering a broken page in front of a learner.
 *
 * Kept free of "server-only" so the build script can import it.
 */

import { z } from "zod";

/**
 * A non-empty string. YAML turns an unquoted `100` into a number and authors
 * should not have to remember to quote answers, so numbers are accepted and
 * converted.
 */
const Text = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1));

const TextList = z.array(Text).min(1);

/** `[target, english]` — an example sentence or a vocabulary entry. */
const Pair = z.tuple([Text, Text]);

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase-words-with-dashes");

export const TableSchema = z
  .object({
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(Text)).min(1),
  })
  .refine((table) => table.rows.every((row) => row.length === table.columns.length), {
    message: "every table row needs exactly one cell per column",
  });

export const SectionSchema = z.object({
  heading: Text,
  /** Paragraphs separated by blank lines; `- ` bullets; **bold**, *italic*. */
  body: Text,
  table: TableSchema.optional(),
  examples: z.array(Pair).optional(),
  /** A "watch out" note, usually aimed at English speakers' typical mistakes. */
  tip: Text.optional(),
});

const BLANK = "___";

/**
 * Set on items that test the accent itself (c or ç? e or é?). Normally a
 * missing accent is graded "close"; here it is simply wrong.
 */
const StrictAccents = z.boolean().optional();

/**
 * The lesson section (1 = the first) whose idea the item tests. The guided
 * path teaches one section at a time and asks that section's questions right
 * after it, so every item needs one.
 */
const Section = z.number().int().min(1).max(8);

const FillItemSchema = z.object({
  type: z.literal("fill"),
  prompt: Text.refine((prompt) => prompt.split(BLANK).length === 2, {
    message: `a fill prompt must contain exactly one ${BLANK}`,
  }),
  /** Shown next to the blank, e.g. "(essere, io)" or "(the)". */
  hint: Text.optional(),
  /** English for the whole sentence, so the learner knows what is meant. */
  translation: Text.optional(),
  answers: TextList,
  why: Text,
  strict_accents: StrictAccents,
  section: Section,
});

const TranslateItemSchema = z.object({
  type: z.literal("translate"),
  direction: z.enum(["to-target", "to-english"]),
  prompt: Text,
  answers: TextList,
  why: Text,
  strict_accents: StrictAccents,
  section: Section,
});

const ChoiceItemSchema = z
  .object({
    type: z.literal("choice"),
    prompt: Text,
    options: z.array(Text).min(2).max(5),
    answer: Text,
    why: Text,
    section: Section,
  })
  .refine((item) => item.options.includes(item.answer), {
    message: "a choice answer must be exactly one of its options",
  });

export const PracticeItemSchema = z.discriminatedUnion("type", [
  FillItemSchema,
  TranslateItemSchema,
  ChoiceItemSchema,
]);

export const LessonFileSchema = z.object({
  title: Text,
  subtitle: Text.optional(),
  /** Completes the sentence "After this lesson you can…". */
  goal: Text,
  minutes: z.number().int().min(3).max(30),
  sections: z.array(SectionSchema).min(1).max(8),
  words: z.array(Pair).default([]),
  practice: z.array(PracticeItemSchema).min(6).max(16),
});

export const LevelFileSchema = z.object({
  title: Text,
  summary: Text,
  can_do: z.array(Text).min(3),
  grammar: z
    .array(
      z.object({
        topic: Text,
        /** Lesson slugs at this level that teach the topic, e.g. "04-articles". */
        lessons: z.array(Slug).default([]),
      }),
    )
    .min(3),
  themes: z.array(Text).min(1),
  /**
   * The level's sub-levels, in order (A1.1, A1.2, …). Each groups lessons,
   * phrasebook situations and vocabulary-library categories; the guided path
   * teaches a unit's contents and counts its progress. Every lesson,
   * situation and category of the level belongs to exactly one unit.
   */
  units: z
    .array(
      z.object({
        title: Text,
        lessons: z.array(Slug).default([]),
        situations: z.array(Slug).default([]),
        categories: z.array(z.string().min(1)).default([]),
      }),
    )
    .optional(),
});

export const PhraseSchema = z.object({
  /** Accepted target-language forms; the first is the one displayed. */
  target: TextList,
  /** Accepted English renderings; the first is the one displayed. */
  english: TextList,
  /** Display override, e.g. "Sono americano / americana." */
  display: Text.optional(),
  note: Text.optional(),
  /** Word-by-word gloss that shows how the phrase is built. */
  literally: Text.optional(),
});

export const PhrasesFileSchema = z.object({
  situations: z
    .array(
      z.object({
        id: Slug,
        title: Text,
        phrases: z.array(PhraseSchema).min(3),
      }),
    )
    .min(3),
});

export type LessonFile = z.infer<typeof LessonFileSchema>;
export type LevelFile = z.infer<typeof LevelFileSchema>;
export type PhrasesFile = z.infer<typeof PhrasesFileSchema>;
export type PracticeItem = z.infer<typeof PracticeItemSchema>;
export type LessonSection = z.infer<typeof SectionSchema>;
export type PhraseEntry = z.infer<typeof PhraseSchema>;

export { BLANK };
