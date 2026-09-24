import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { WrittenDrill } from "@/components/activities/written-drill";

export const metadata = { title: "Fill in the blank — LANGUE" };

export default async function FillBlankPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <WrittenDrill
      context={{ language: user.currentLanguage, level: user.currentLevel }}
      kind="fill_blank"
    />
  );
}
