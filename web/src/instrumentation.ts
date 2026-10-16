/**
 * Runs once when a server starts, before it takes requests.
 *
 * Records every learner's guided-path progress as it stands, so a deploy that
 * adds words to units can never lower anyone's bar (lib/path/store.ts), and
 * gives any certificate awarded before certificates stored their numbers its
 * numbers, once. Both only ever raise or fill, so running them on every start
 * is harmless, and a failure is logged rather than keeping the server from
 * starting.
 *
 * Then starts the hourly check for streak reminders (lib/reminder-sender.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { rememberProgressOnStart } = await import("./lib/path/on-start");
    await rememberProgressOnStart();
  } catch (error) {
    console.error("[langue] could not record progress on start:", error);
  }
  try {
    const { startReminderSchedule } = await import("./lib/reminder-sender");
    startReminderSchedule();
  } catch (error) {
    console.error("[langue] could not start streak reminders:", error);
  }
}
