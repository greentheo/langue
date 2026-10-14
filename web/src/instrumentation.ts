/**
 * Runs once when a server starts, before it takes requests.
 *
 * Records every learner's guided-path progress as it stands, so a deploy that
 * adds words to units can never lower anyone's bar (lib/path/store.ts). It
 * only raises marks, so running it on every start is harmless, and a failure
 * is logged rather than keeping the server from starting.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { rememberProgressOnStart } = await import("./lib/path/on-start");
    await rememberProgressOnStart();
  } catch (error) {
    console.error("[langue] could not record progress on start:", error);
  }
}
