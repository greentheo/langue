import { z } from "zod";
import { handler, readJson, BadRequestError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getPhrase } from "@/lib/curriculum";
import { gradeEnglishAnswer, gradeTargetAnswer, pointsForResult } from "@/lib/engine/grade";
import { difficultyForLevel } from "@/lib/lessons";

/** Grade one phrase card and reveal the full phrase, its note and its gloss. */

const BodySchema = z.object({
  phraseId: z.string().min(1).max(120),
  direction: z.enum(["to-target", "to-english"]),
  answer: z.string().max(500).default(""),
});

export const POST = handler(async (request) => {
  await requireUser();

  const parsed = BodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new BadRequestError("A phrase, a direction and an answer are required.");
  }

  const { phraseId, direction, answer } = parsed.data;
  const phrase = getPhrase(phraseId);
  if (!phrase) {
    throw new BadRequestError("That phrase does not exist.");
  }

  const result =
    direction === "to-target"
      ? gradeTargetAnswer(answer, phrase.target)
      : gradeEnglishAnswer(answer, phrase.english);

  return Response.json({
    verdict: result.verdict,
    score: result.score,
    points: pointsForResult(result, difficultyForLevel(phrase.level)),
    note: result.note,
    display: phrase.display,
    target: phrase.target,
    english: phrase.english,
    phraseNote: phrase.note,
    literally: phrase.literally,
  });
});
