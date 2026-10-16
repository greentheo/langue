import { getCourse } from "./course";
import { freezeCertificates, rememberEveryonesProgress } from "./store";

/** See instrumentation.ts. */
export async function rememberProgressOnStart(): Promise<void> {
  const started = Date.now();
  const raised = await rememberEveryonesProgress(getCourse);
  const frozen = await freezeCertificates(getCourse);
  console.log(
    `[langue] progress recorded on start: ${raised} unit bar(s) raised, ${frozen} certificate(s) given their numbers, in ${Date.now() - started} ms`,
  );
}
