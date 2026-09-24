import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { Conversation } from "@/components/activities/conversation";
import { isBeginnerLevel } from "@/lib/engine/levels";
import { isLevel } from "@/lib/vocab";

export const metadata = { title: "Conversation — LANGUE" };

export default async function ConversationPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  // Beginner support (translations on by default) mirrors the CLI: A1/A2 only.
  const beginner = isLevel(user.currentLevel) && isBeginnerLevel(user.currentLevel);

  return (
    <Conversation
      context={{ language: user.currentLanguage, level: user.currentLevel }}
      beginner={beginner}
    />
  );
}
