import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getLesson, getPhrase } from "@/lib/curriculum";
import { gradeTargetAnswer, pointsForResult, type GradeResult } from "@/lib/engine/grade";
import { difficultyForLevel, gradePracticeItem } from "@/lib/engine/practice";
import { getCourse } from "@/lib/path/course";
import { rungOf } from "@/lib/path/schedule";
import { blankOut, gradeReply, sameSentence } from "@/lib/path/sentences";
import { recordAnswer, recordChallengeAnswer, recordDialoguePlayed } from "@/lib/path/store";
import type { Course, CourseDialogue, Item, StepAnswerResult } from "@/lib/path/types";

/**
 * Grade one answer in a step and move the item along its stage ladder.
 *
 * Everything is checked against the course on the server: the item, that the
 * question, sentence or role-play turn belongs to it, and the right answer.
 * How far a right answer can move the item depends on the exercise — picking
 * a meaning proves less than typing the word, which proves less than using it
 * in a sentence (lib/path/schedule.ts).
 *
 * A role-play turn ("turn") is graded for the role-play, and moves every word
 * and phrase its model answer uses; the last turn schedules the role-play's
 * next outing.
 */

const BodySchema = z.object({
  itemKey: z.string().min(1).max(200),
  mode: z.enum(["recognize", "recall", "build", "type", "cloze", "reply", "question", "turn"]),
  question: z.number().int().min(0).max(50).optional(),
  sentence: z.string().min(1).max(300).optional(),
  dialogue: z.string().min(1).max(200).optional(),
  line: z.number().int().min(0).max(20).optional(),
  /** A role-play turn: typed, or picked from a few replies. */
  typed: z.boolean().optional(),
  /** A role-play turn: the last of the learner's turns. */
  last: z.boolean().optional(),
  /** Part of a level-up challenge: a right answer counts as learned, a wrong one costs nothing. */
  challenge: z.boolean().optional(),
  answer: z.string().max(500).default(""),
});

type Body = z.infer<typeof BodySchema>;

const RIGHT: GradeResult = { verdict: "correct", score: 100, matched: null, note: null };
const WRONG: GradeResult = { verdict: "incorrect", score: 0, matched: null, note: null };

type Graded = Omit<StepAnswerResult, "stage" | "promoted">;

function graded(result: GradeResult, level: string, answers: string[], why: string | null = null): Graded {
  return {
    verdict: result.verdict,
    points: pointsForResult(result, difficultyForLevel(level)),
    note: result.note,
    endingMiss: result.endingMiss,
    answers,
    why,
  };
}

/** The learner's turn in a role-play, checked to belong to it. */
function turnOf(dialogue: CourseDialogue | undefined, line: number | undefined) {
  const turn = dialogue && line !== undefined ? dialogue.lines[line] : undefined;
  if (turn?.kind !== "you") throw new BadRequestError("That is not one of your turns in this role-play.");
  return turn;
}

/** Tiles in order: the sentence is right or it is not. */
function gradeBuild(course: Course, body: Body, allowed: string[], level: string): Graded {
  const sentence = body.sentence ? course.sentences.get(body.sentence) : undefined;
  if (!sentence || !allowed.includes(sentence.id)) {
    throw new BadRequestError("That sentence does not belong to this item.");
  }
  return graded(sameSentence(body.answer, sentence.target) ? RIGHT : WRONG, level, [sentence.target]);
}

async function roleplayTurn(
  userId: string,
  language: string,
  course: Course,
  body: Body,
): Promise<StepAnswerResult> {
  const dialogue = course.dialogues.get(body.itemKey);
  const turn = turnOf(dialogue, body.line);
  const level = course.units[dialogue!.unitIndex].level;

  // A picked reply is right or wrong; a typed one gets typo and accent leniency.
  const result = body.typed
    ? gradeReply(body.answer, turn.answers, language)
    : body.answer.trim() === turn.answers[0]
      ? RIGHT
      : WRONG;

  const now = new Date();
  let promoted = false;
  for (const key of turn.itemKeys) {
    const item = course.items.get(key);
    if (!item) continue;
    const { before, after } = await recordAnswer(
      userId,
      language,
      item,
      {
        correct: result.verdict !== "incorrect",
        // Typing the reply is using the words; picking it is recognising them.
        rung: rungOf(body.typed ? "reply" : "recall", item),
      },
      now,
    );
    if (after.stage > before.stage) promoted = true;
  }
  if (body.last) await recordDialoguePlayed(userId, language, dialogue!.key, now);

  return { ...graded(result, level, [turn.answers[0]]), stage: 0, promoted };
}

function gradeItem(course: Course, item: Item, body: Body, level: string): Graded {
  const { mode, answer } = body;

  if (item.kind === "grammar") {
    if (mode === "build") return gradeBuild(course, body, item.builds, level);
    const lesson = getLesson(item.lessonId);
    const question = body.question;
    const practice = question === undefined ? undefined : lesson?.practice[question];
    if (mode !== "question" || !practice || !item.questions.some((q) => q.index === question)) {
      throw new BadRequestError("That question does not belong to this idea.");
    }
    const grade = gradePracticeItem(practice, answer, level, course.language);
    return {
      verdict: grade.verdict,
      points: grade.points,
      note: grade.note,
      endingMiss: grade.endingMiss,
      answers: grade.answers,
      why: grade.why,
    };
  }

  const phrase = item.kind === "phrase" ? getPhrase(item.phraseId) : null;
  const why = phrase?.literally ? `Literally: ${phrase.literally}` : (phrase?.note ?? null);

  switch (mode) {
    case "recognize":
    case "recall": {
      // A clicked option is right or wrong.
      const expected = mode === "recognize" ? item.english : item.target;
      return graded(answer.trim() === expected ? RIGHT : WRONG, level, [expected], why);
    }
    case "type":
      return graded(gradeTargetAnswer(answer, item.accepted, course.language), level, [item.target], why);
    case "build":
      if (item.kind !== "phrase" || !item.build) throw new BadRequestError("This item is not built from tiles.");
      return gradeBuild(course, body, [item.build], level);
    case "cloze": {
      const sentence = body.sentence ? course.sentences.get(body.sentence) : undefined;
      const blank = sentence && item.kind === "word" && item.clozes.includes(sentence.id) ? blankOut(sentence.target, item.accepted) : null;
      if (!sentence || !blank) throw new BadRequestError("That sentence does not belong to this word.");
      return graded(gradeTargetAnswer(answer, [blank.answer], course.language), level, [blank.answer]);
    }
    case "reply": {
      const dialogue = body.dialogue ? course.dialogues.get(body.dialogue) : undefined;
      if (!item.replies.some((reply) => reply.dialogue === body.dialogue && reply.line === body.line)) {
        throw new BadRequestError("That role-play turn does not use this item.");
      }
      const turn = turnOf(dialogue, body.line);
      return graded(gradeReply(answer, turn.answers, course.language), level, [turn.answers[0]]);
    }
    default:
      throw new BadRequestError("Words and phrases have no lesson questions.");
  }
}

export const POST = handler(async (request) => {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("An item, an exercise and an answer are required.");
  }

  const body = parsed.data;
  const language = user.currentLanguage;
  const course = getCourse(language);

  if (body.mode === "turn") {
    return Response.json(await roleplayTurn(user.id, language, course, body));
  }

  const item = course.items.get(body.itemKey);
  if (!item) {
    throw new BadRequestError("That item is not on your path. Did you change language?");
  }

  const level = course.units[item.unitIndex].level;
  const result = gradeItem(course, item, body, level);

  const correct = result.verdict !== "incorrect";
  const { before, after } = body.challenge
    ? await recordChallengeAnswer(user.id, language, item, correct, new Date())
    : await recordAnswer(user.id, language, item, { correct, rung: rungOf(body.mode, item) }, new Date());

  const response: StepAnswerResult = { ...result, stage: after.stage, promoted: after.stage > before.stage };
  return Response.json(response);
});
