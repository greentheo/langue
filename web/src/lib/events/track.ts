import "server-only";

/**
 * In-house events (#109): written to the app's own database, never sent
 * anywhere. Awaited where they happen, and never able to fail a request.
 * EVENTS_OFF=1 turns them off; the app works the same.
 */

import { prisma } from "@/lib/db";
import { createTracker } from "./tracker";

export const track = createTracker((row) => prisma.event.create({ data: row }));
