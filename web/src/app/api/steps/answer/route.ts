import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getLesson, getPhrase } from "@/lib/curriculum";
import { gradeTargetAnswer, pointsForResult, type GradeResult } from "@/lib/engine/grade";
import { difficultyForLevel, gradePracticeItem } from "@/lib/engine/practice";
import { getCourse } from "@/lib/path/course";
import { rungOf } from "@/lib/path/schedule";
import { recordAnswer } from "@/lib/path/store";
import type { StepAnswerResult } from "@/lib/path/types";

/**
 * Grade one answer in a step and move the item along its stage ladder.
 *
 * Everything is checked against the course on the server: the item, that the
 * question belongs to it, and the right answer. How far a right answer can
 * move the item depends on the exercise — picking a meaning proves less than
 * typing the word (lib/path/schedule.ts).
 */

const BodySchema = z.object({
  itemKey: z.string().min(1).max(200),
  mode: z.enum(["recognize", "recall", "type", "question"]),
  question: z.number().int().min(0).max(50).optional(),
  answer: z.string().max(500).default(""),
});

const RIGHT: GradeResult = { verdict: "correct", score: 100, matched: null, note: null };
const WRONG: GradeResult = { verdict: "incorrect", score: 0, matched: null, note: null };

export const POST = handler(async (request) => {
  const user = await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("An item, an exercise and an answer are required.");
  }

  const { itemKey, mode, question, answer } = parsed.data;
  const language = user.currentLanguage;
  const course = getCourse(language);
  const item = course.items.get(itemKey);
  if (!item) {
    throw new BadRequestError("That item is not on your path. Did you change language?");
  }

  const level = course.units[item.unitIndex].level;
  let graded: Omit<StepAnswerResult, "stage" | "promoted">;

  if (item.kind === "grammar") {
    const lesson = getLesson(item.lessonId);
    const practice = question === undefined ? undefined : lesson?.practice[question];
    if (mode !== "question" || !practice || !item.questions.some((q) => q.index === question)) {
      throw new BadRequestError("That question does not belong to this idea.");
    }
    const grade = gradePracticeItem(practice, answer, level);
    graded = {
      verdict: grade.verdict,
      points: grade.points,
      note: grade.note,
      answers: grade.answers,
      why: grade.why,
    };
  } else {
    if (mode === "question") throw new BadRequestError("Words and phrases have no lesson questions.");

    // A clicked option is right or wrong; typing gets typo and accent leniency.
    const expected = mode === "recognize" ? item.english : item.target;
    const result =
      mode === "type"
        ? gradeTargetAnswer(answer, item.accepted)
        : answer.trim() === expected
          ? RIGHT
          : WRONG;

    const phrase = item.kind === "phrase" ? getPhrase(item.phraseId) : null;
    graded = {
      verdict: result.verdict,
      points: pointsForResult(result, difficultyForLevel(level)),
      note: result.note,
      answers: [expected],
      why: phrase?.literally ? `Literally: ${phrase.literally}` : (phrase?.note ?? null),
    };
  }

  const { before, after } = await recordAnswer(
    user.id,
    language,
    item,
    { correct: graded.verdict !== "incorrect", rung: rungOf(mode, item.kind) },
    new Date(),
  );

  const result: StepAnswerResult = { ...graded, stage: after.stage, promoted: after.stage > before.stage };
  return Response.json(result);
});
