import "server-only";

/**
 * Shared route-handler plumbing.
 *
 * Every activity endpoint needs the same three things: the signed-in user, a
 * validated JSON body, and a consistent error shape. Doing it once here keeps
 * the handlers to their actual logic.
 */

import { z } from "zod";
import { requireUser, UnauthorizedError, type SessionUser } from "@/lib/auth/session";
import { ModelUnavailableError } from "@/lib/engine/model";
import { ModelParseError } from "@/lib/engine/parse";
import { isLevel, hasLanguage } from "@/lib/vocab";
import type { Level } from "@/lib/vocab/types";

/** Body fields every activity request carries. */
export const ActivityContextSchema = z.object({
  language: z.string().min(1),
  level: z.string().min(1),
});

export interface ResolvedContext {
  user: SessionUser;
  language: string;
  level: Level;
  nativeLanguage: string;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Map a thrown error to an honest HTTP response.
 *
 * Model failures surface as 503 with the real reason, never as a 200 carrying
 * invented content.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return jsonError("Sign in to continue.", 401);
  }

  if (error instanceof ModelUnavailableError) {
    return jsonError(error.message, 503);
  }

  if (error instanceof ModelParseError) {
    console.error("[langue] model returned unusable output:", error.raw.slice(0, 800));
    return jsonError(
      "The model returned something this activity could not read. Try again.",
      502,
    );
  }

  console.error("[langue] unhandled route error:", error);
  return jsonError("Something went wrong on the server.", 500);
}

/**
 * Authenticate the request and validate the language/level it names.
 *
 * Validating against the actual catalog matters: a request for a language with
 * no vocabulary would otherwise produce an empty word pool and a confusing
 * empty exercise set rather than a clear 400.
 */
export async function resolveContext(body: unknown): Promise<ResolvedContext> {
  const user = await requireUser();
  const parsed = ActivityContextSchema.safeParse(body);

  if (!parsed.success) {
    throw new BadRequestError("Request is missing a language or level.");
  }

  const language = parsed.data.language.toLowerCase();
  const level = parsed.data.level.toLowerCase();

  if (!hasLanguage(language)) {
    throw new BadRequestError(`No vocabulary is available for "${language}".`);
  }
  if (!isLevel(level)) {
    throw new BadRequestError(`"${level}" is not a CEFR level.`);
  }

  return { user, language, level, nativeLanguage: user.nativeLanguage };
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/** Wrap a handler so thrown errors become well-formed responses. */
export function handler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof BadRequestError) return jsonError(error.message, 400);
      return errorResponse(error);
    }
  };
}

/** Parse a JSON body, treating malformed JSON as a 400 rather than a crash. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("Request body was not valid JSON.");
  }
}
