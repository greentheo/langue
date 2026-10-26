import { handler } from "@/lib/api";
import { requireUser, clearAdminConfirmation } from "@/lib/auth/session";

/**
 * An admin page was hidden or left in the browser (components/admin-watch.tsx):
 * end the admin confirmation (#119). It only ever takes access away, so it
 * needs nothing but a signed-in learner.
 */
export const POST = handler(async () => {
  await requireUser();
  await clearAdminConfirmation();
  return new Response(null, { status: 204 });
});
