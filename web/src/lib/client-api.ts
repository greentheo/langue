/**
 * Typed fetch helpers for the browser.
 *
 * Every activity talks to the API the same way, and every one of them needs to
 * surface a real error message when the model or network fails. Centralizing
 * that means no component silently renders an empty state on a 503.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** POST JSON and parse the response, turning any error body into an ApiError. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Non-JSON error body; the status-based message stands.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export interface ActivityContext {
  language: string;
  level: string;
}

/** Report a finished session. Failures here must not lose the learner's round. */
export async function reportProgress(
  context: ActivityContext,
  payload: {
    activityType: "flashcards" | "conversation" | "fill_blank" | "translation" | "reading";
    pointsEarned: number;
    itemsTotal: number;
    itemsCorrect: number;
    durationSec: number;
    words?: { word: string; correct: boolean }[];
  },
): Promise<void> {
  try {
    await postJson("/api/progress", { ...context, ...payload });
  } catch (error) {
    // The round already happened and the learner saw their results. Losing the
    // points row is worth a console warning, not an error screen.
    console.warn("[langue] could not record progress:", error);
  }
}
