import { z } from "zod";
import { handler, readJson, resolveContext, BadRequestError } from "@/lib/api";
import { streamCompletion } from "@/lib/engine/model";
import { conversationSystemPrompt } from "@/lib/engine/prompts";

/**
 * Conversation turn, streamed as Server-Sent Events.
 *
 * The whole transcript is posted each turn rather than kept server-side. For a
 * capped-length practice conversation that is far simpler than session storage,
 * and the cap is enforced here so a long chat cannot grow the context — and the
 * bill — without limit.
 */

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(60),
  topic: z.string().max(200).optional(),
  character: z.string().max(200).optional(),
  bilingual: z.boolean().default(false),
  correctionMode: z.enum(["none", "gentle", "detailed"]).default("gentle"),
});

/** Turns of history sent to the model. Older turns fall out of context. */
const HISTORY_WINDOW = 24;

export const POST = handler(async (request) => {
  const body = await readJson(request);
  const { language, level, nativeLanguage } = await resolveContext(body);

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Conversation request was malformed.");
  }

  const { messages, topic, character, bilingual, correctionMode } = parsed.data;

  const system = conversationSystemPrompt({
    language,
    level,
    nativeLanguage,
    topic,
    character,
    bilingual,
    correctionMode,
  });

  const stream = streamCompletion({
    system,
    messages: messages.slice(-HISTORY_WINDOW),
    maxTokens: 700,
    temperature: 0.85,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Railway sits behind a proxy that will otherwise buffer the stream and
      // deliver it all at once, defeating the point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
});
