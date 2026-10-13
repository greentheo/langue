"use client";

/**
 * Record a finished session, then refresh what the server rendered.
 *
 * The header's points and streak live in the /learn layout, and Next.js keeps
 * layouts mounted across in-app navigation — so without a refresh the header
 * shows the numbers from whenever the page was first loaded. router.refresh()
 * re-renders the server components in place, keeping every client component's
 * state (a summary screen stays on screen).
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { reportProgress, type ActivityContext, type ProgressPayload } from "@/lib/client-api";

export function useReportProgress() {
  const router = useRouter();

  return useCallback(
    async (context: ActivityContext, payload: ProgressPayload) => {
      if (await reportProgress(context, payload)) router.refresh();
    },
    [router],
  );
}
