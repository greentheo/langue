import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { recordSession } from "@/lib/progress";

/**
 * Record a completed activity session.
 *
 * The single write path for points. Clients report what happened; the server
 * decides what it is worth and updates totals in one transaction.
 */

const BodySchema = z.object({
  activityType: z.enum(["flashcards", "conversation", "fill_blank", "translation", "reading"]),
  pointsEarned: z.number().int().min(0).max(10_000),
  itemsTotal: z.number().int().min(0).max(1000),
  itemsCorrect: z.number().int().min(0).max(1000),
  durationSec: z.number().int().min(0).max(24 * 60 * 60),
  words: z
    .array(z.object({ word: z.string().min(1).max(120), correct: z.boolean() }))
    .max(200)
    .default([]),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { user, language, level } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Progress payload was malformed.");
  }

  const data = parsed.data;

  if (data.itemsCorrect > data.itemsTotal) {
    throw new BadRequestError("itemsCorrect cannot exceed itemsTotal.");
  }

  await recordSession({
    userId: user.id,
    activityType: data.activityType,
    language,
    level,
    pointsEarned: data.pointsEarned,
    itemsTotal: data.itemsTotal,
    itemsCorrect: data.itemsCorrect,
    durationSec: data.durationSec,
    words: data.words,
  });

  return Response.json({ ok: true });
});
