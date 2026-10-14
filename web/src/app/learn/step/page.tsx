import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { StepRunner } from "@/components/step/step-runner";

export const metadata = { title: "Step — LANGUE" };

/** One step on the guided path. Everything happens in the client runner. */
export default async function StepPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return <StepRunner language={user.currentLanguage} />;
}
