import "server-only";

/**
 * Anthropic client and the single place model failures are handled.
 *
 * The CLI's cardinal sin was turning every API error into a plausible-looking
 * canned response, so a learner practising against a dead API saw fluent
 * nonsense and no error (issue #4). Nothing here invents content: a failed call
 * raises ModelUnavailableError and the UI says so.
 */

import Anthropic from "@anthropic-ai/sdk";

/** Central model registry, mirroring langue/models/registry.py. */
export const MODELS = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-5",
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Default tier. Conversation and exercise generation are short, high-volume
 * calls where Haiku's latency and price matter more than peak reasoning.
 */
export const DEFAULT_TIER: ModelTier = "fast";

export class ModelUnavailableError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelUnavailableError";
    this.status = status;
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModelUnavailableError(
      "ANTHROPIC_API_KEY is not set on the server. Add it to the deployment " +
        "environment and restart.",
    );
  }

  client = new Anthropic({
    apiKey,
    // A learner staring at a blank card should get an error, not a hang.
    timeout: 60_000,
    maxRetries: 2,
  });
  return client;
}

/** Convert any SDK/network failure into our own typed error. */
function asModelError(error: unknown): ModelUnavailableError {
  if (error instanceof ModelUnavailableError) return error;

  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    const detail =
      status === 401
        ? "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY."
        : status === 429
          ? "Rate limited by the Anthropic API. Wait a moment and try again."
          : status === 404
            ? `The configured model was not found (${error.message}). It may have been retired.`
            : error.message;
    return new ModelUnavailableError(detail, status);
  }

  if (error instanceof Error) {
    return new ModelUnavailableError(`Could not reach the Anthropic API: ${error.message}`);
  }

  return new ModelUnavailableError("Could not reach the Anthropic API.");
}

export interface CompletionOptions {
  system: string;
  messages: Anthropic.MessageParam[];
  tier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
}

/** One non-streaming completion, returning the concatenated text blocks. */
export async function complete(options: CompletionOptions): Promise<string> {
  const { system, messages, tier = DEFAULT_TIER, maxTokens = 1500, temperature = 0.7 } = options;

  try {
    const response = await getClient().messages.create({
      model: MODELS[tier],
      system,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      throw new ModelUnavailableError("The model returned an empty response.");
    }

    return text;
  } catch (error) {
    throw asModelError(error);
  }
}

/**
 * Stream a completion as an SSE-ready ReadableStream of text deltas.
 *
 * Conversation is the one activity where waiting for the full reply is a worse
 * experience than reading it as it arrives.
 */
export function streamCompletion(options: CompletionOptions): ReadableStream<Uint8Array> {
  const { system, messages, tier = DEFAULT_TIER, maxTokens = 1500, temperature = 0.8 } = options;
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const stream = await getClient().messages.stream({
          model: MODELS[tier],
          system,
          messages,
          max_tokens: maxTokens,
          temperature,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "delta", text: event.delta.text });
          }
        }

        send({ type: "done" });
      } catch (error) {
        // The stream has already started, so the only way to report a failure
        // is in-band. The client renders this as an error, never as content.
        send({ type: "error", message: asModelError(error).message });
      } finally {
        controller.close();
      }
    },
  });
}
