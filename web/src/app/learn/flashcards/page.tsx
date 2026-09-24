import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { Flashcards } from "@/components/activities/flashcards";

export const metadata = { title: "Flashcards — LANGUE" };

export default async function FlashcardsPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <Flashcards
      context={{ language: user.currentLanguage, level: user.currentLevel }}
    />
  );
}
