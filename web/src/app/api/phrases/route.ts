import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { getLevelCurriculum } from "@/lib/curriculum";
import { sampleWords } from "@/lib/vocab";

/**
 * Deal a round of phrase cards. As with flashcards, only the side being shown
 * goes to the browser; /api/phrases/answer grades and reveals the other side.
 */

const BodySchema = z.object({
  direction: z.enum(["to-target", "to-english"]).default("to-english"),
  situation: z.string().max(60).default("all"),
  count: z.number().int().min(1).max(30).default(10),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { language, level } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Pick a direction, a situation and a round size.");
  }

  const { direction, situation, count } = parsed.data;
  const situations = getLevelCurriculum(language, level)?.situations ?? [];
  const chosen = situation === "all" ? situations : situations.filter((s) => s.id === situation);

  const pool = chosen.flatMap((s) => s.phrases.map((phrase) => ({ phrase, title: s.title })));
  if (pool.length === 0) {
    throw new BadRequestError(`No phrases are available for ${language} ${level.toUpperCase()} yet.`);
  }

  const cards = sampleWords(pool, count).map(({ phrase, title }) => ({
    id: phrase.id,
    situation: title,
    prompt: direction === "to-english" ? phrase.display : phrase.english[0],
  }));

  return Response.json({ cards });
});
