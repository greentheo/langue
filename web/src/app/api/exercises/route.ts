import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import {
  generateFillBlank,
  generateReading,
  generateTranslation,
} from "@/lib/engine/activities";

/**
 * Generate an exercise set for fill-in-the-blank, translation, or reading.
 *
 * One endpoint for all three because they differ only in which generator runs;
 * auth, validation, and error handling are identical.
 */

const BodySchema = z.object({
  kind: z.enum(["fill_blank", "translation", "reading"]),
  count: z.number().int().min(1).max(10).default(5),
  direction: z.enum(["to-target", "to-native"]).default("to-target"),
  topic: z.string().max(200).optional(),
});

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { language, level, nativeLanguage } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Exercise request was malformed.");
  }

  const { kind, count, direction, topic } = parsed.data;
  const context = { language, level, nativeLanguage };

  if (kind === "fill_blank") {
    return Response.json({ kind, exercises: await generateFillBlank(context, count) });
  }

  if (kind === "translation") {
    return Response.json({
      kind,
      direction,
      exercises: await generateTranslation(context, count, direction),
    });
  }

  return Response.json({ kind, passage: await generateReading(context, topic, count) });
});
