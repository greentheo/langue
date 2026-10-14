import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { StepRunner } from "@/components/step/step-runner";

export const metadata = { title: "Step — LANGUE" };

/**
 * One step on the guided path, or with ?challenge=<unit id> a unit's level-up
 * challenge. Everything happens in the client runner.
 */
export default async function StepPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const { challenge } = await searchParams;
  const unit = typeof challenge === "string" ? challenge : undefined;
  // A new key per challenge, so moving on to the next one starts fresh.
  return <StepRunner key={unit ?? "step"} language={user.currentLanguage} challenge={unit} />;
}
