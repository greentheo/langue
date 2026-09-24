import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { Reading } from "@/components/activities/reading";

export const metadata = { title: "Reading — LANGUE" };

export default async function ReadingPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <Reading context={{ language: user.currentLanguage, level: user.currentLevel }} />
  );
}
