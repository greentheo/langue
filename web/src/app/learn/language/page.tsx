import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { LanguageChooser } from "@/components/language-chooser";

export default async function LanguagePage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-xl crt-glow">What do you want to learn?</h1>
      <p className="text-sm text-[var(--crt-fg-dim)]">
        Each language keeps its own progress, so you can switch back any time.
      </p>
      <LanguageChooser current={user.currentLanguage} />
      <p className="text-xs">
        <Link href="/learn">&larr; Back</Link>
      </p>
    </div>
  );
}
