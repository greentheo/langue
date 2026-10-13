"use client";

/**
 * The activity context, with a stable identity.
 *
 * Pages pass `{ language, level }` as a fresh object on every server render,
 * and a server render happens whenever a finished session refreshes the page
 * (see use-report-progress.ts). Activities that deal or generate on mount key
 * their effects on the context — keyed on a fresh object, a refresh would
 * throw away the summary screen and deal a new round (or pay for a new
 * generated exercise). Keyed on this, only a real change of language or level
 * does.
 */

import { useMemo } from "react";
import type { ActivityContext } from "@/lib/client-api";

export function useStableContext({ language, level }: ActivityContext): ActivityContext {
  return useMemo(() => ({ language, level }), [language, level]);
}
