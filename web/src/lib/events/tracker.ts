/**
 * The core of track(): clean the props, honour EVENTS_OFF, and never let an
 * event fail the request it was part of. The database write is passed in, so
 * this is tested without one (lib/events/track.ts wires it to Prisma).
 */

import { cleanProps, type EventType } from "./props";

export interface EventRow {
  type: EventType;
  userId: string | null;
  visitor: string | null;
  props: Record<string, string | number>;
}

export interface EventInput {
  /** The learner, for events in the app. */
  userId?: string | null;
  /** The daily visitor hash, for the public pages (visitor.ts). */
  visitor?: string | null;
  props?: Record<string, unknown>;
}

export function createTracker(write: (row: EventRow) => Promise<unknown>, env: () => string | undefined = () => process.env.EVENTS_OFF) {
  return async function track(type: EventType, { userId = null, visitor = null, props = {} }: EventInput = {}): Promise<void> {
    if (env() === "1") return;
    try {
      await write({ type, userId, visitor, props: cleanProps(props) });
    } catch (error) {
      // An event is never worth a failed request: note it and move on.
      console.error(`[langue] event ${type} not recorded: ${(error as Error).message}`);
    }
  };
}
