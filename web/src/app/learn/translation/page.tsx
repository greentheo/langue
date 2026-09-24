import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { TranslationDrill } from "@/components/activities/translation-drill";

export const metadata = { title: "Translation — LANGUE" };

export default async function TranslationPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <TranslationDrill
      context={{ language: user.currentLanguage, level: user.currentLevel }}
    />
  );
}
