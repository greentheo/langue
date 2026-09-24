/**
 * Extracting structured data from model output.
 *
 * The Python CLI reimplements this in six places, each handling a different
 * subset of the ways a model wraps JSON — fenced blocks, prose preambles,
 * trailing commentary. Every one of them throws on the cases it missed, which
 * surfaces to the learner as a crashed activity.
 *
 * This is one implementation that handles all of them and, critically,
 * distinguishes "the model returned something unusable" from "the model
 * returned valid data" so callers can fail honestly instead of silently
 * substituting canned content (issue #4 in the CLI).
 */

import { z } from "zod";

export class ModelParseError extends Error {
  readonly raw: string;

  constructor(message: string, raw: string) {
    super(message);
    this.name = "ModelParseError";
    this.raw = raw;
  }
}

/**
 * Pull the first complete JSON value out of arbitrary model text.
 *
 * Strategy, in order:
 *  1. A fenced ```json block, which well-behaved models emit.
 *  2. Any fenced block at all.
 *  3. Brace/bracket matching from the first `{` or `[`, respecting strings and
 *     escapes so a `}` inside a translation doesn't truncate the value.
 *
 * Returns null when nothing JSON-shaped is present.
 */
export function extractJson(text: string): string | null {
  const trimmed = text.trim();

  const fencedJson = /```(?:json|JSON)\s*\n([\s\S]*?)```/.exec(trimmed);
  if (fencedJson?.[1]) return fencedJson[1].trim();

  const fencedAny = /```\s*\n?([\s\S]*?)```/.exec(trimmed);
  if (fencedAny?.[1]?.trim().match(/^[[{]/)) return fencedAny[1].trim();

  const start = trimmed.search(/[[{]/);
  if (start === -1) return null;

  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === opener) depth += 1;
    else if (char === closer) {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Parse model output against a Zod schema.
 *
 * Throws ModelParseError with the raw text attached, so the caller can log what
 * the model actually said rather than a generic failure.
 */
export function parseModelJson<T>(text: string, schema: z.ZodType<T>): T {
  const candidate = extractJson(text);
  if (candidate === null) {
    throw new ModelParseError("No JSON found in model response", text);
  }

  let value: unknown;
  try {
    value = JSON.parse(candidate);
  } catch (error) {
    throw new ModelParseError(
      `Model returned malformed JSON: ${(error as Error).message}`,
      text,
    );
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ModelParseError(
      `Model JSON did not match the expected shape: ${result.error.message}`,
      text,
    );
  }

  return result.data;
}
