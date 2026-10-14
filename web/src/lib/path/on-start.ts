import { getCourse } from "./course";
import { rememberEveryonesProgress } from "./store";

/** See instrumentation.ts. */
export async function rememberProgressOnStart(): Promise<void> {
  const started = Date.now();
  const raised = await rememberEveryonesProgress(getCourse);
  console.log(`[langue] progress recorded on start: ${raised} unit bar(s) raised in ${Date.now() - started} ms`);
}
