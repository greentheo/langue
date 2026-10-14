import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLevelCurriculum } from "@/lib/curriculum";
import { languageLabel } from "@/lib/languages";
import { LEVEL_LABELS, type Level } from "@/lib/vocab/types";
import { getCourse } from "@/lib/path/course";
import { levelAchievement, levelProgress, levelsOf } from "@/lib/path/levels";
import { loadMarks, loadStates } from "@/lib/path/store";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Certificate — LANGUE" };

/**
 * A certificate for a finished level: who, which level, when, and what it
 * took. Only shown once the level is recorded as finished.
 */
export default async function CertificatePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const language = user.currentLanguage;
  const course = getCourse(language);
  const requested = (await searchParams).level;
  const level = typeof requested === "string" && levelsOf(course).includes(requested) ? requested : "a1";

  const earned = await prisma.achievement.findUnique({
    where: { userId_name: { userId: user.id, name: levelAchievement(language, level) } },
  });
  const name = `${languageLabel(language)} ${level.toUpperCase()}`;

  if (!earned) {
    return (
      <div className="space-y-4">
        <p>Your {name} certificate appears here once every unit of {level.toUpperCase()} is complete.</p>
        <Link href={`/learn/level?level=${level}`} className="crt-button no-underline">
          See your progress
        </Link>
      </div>
    );
  }

  const [states, marks] = await Promise.all([loadStates(user.id, language), loadMarks(user.id)]);
  const progress = levelProgress(course, states, level, marks);
  const practised = await prisma.activityLog.aggregate({
    where: { userId: user.id, language, level },
    _sum: { durationSec: true },
  });
  const hours = Math.round(((practised._sum.durationSec ?? 0) / 3600) * 10) / 10;
  const canDo = getLevelCurriculum(language, level)?.overview?.canDo ?? [];

  return (
    <div className="space-y-6">
      <div className="border-4 border-double border-[var(--crt-accent)] px-6 py-10 text-center">
        <p className="crt-label">Langue · certificate</p>
        <p className="mt-6 text-sm text-[var(--crt-fg-dim)]">This is to say that</p>
        <p className="mt-2 text-3xl text-[var(--crt-fg-bright)] crt-glow">{user.displayName}</p>
        <p className="mt-4 text-sm text-[var(--crt-fg-dim)]">has completed</p>
        <p className="mt-2 text-2xl text-[var(--crt-accent)] crt-glow">
          {name} · {LEVEL_LABELS[level as Level] ?? ""}
        </p>
        <p className="mt-4 text-sm">
          {earned.earnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <p className="mx-auto mt-8 max-w-md text-sm">
          {[
            `${progress.words.done} words`,
            `${progress.phrases.done} phrases`,
            `${progress.grammar.done} grammar ideas`,
            progress.speaking.done > 0 ? `${progress.speaking.done} conversations` : null,
            hours > 0 ? `${hours} hours of practice` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {canDo.length > 0 ? (
          <ul className="mx-auto mt-6 max-w-md space-y-1 text-left text-xs">
            {canDo.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[var(--crt-accent)]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <Link href={`/learn/level?level=${level}`} className="crt-button no-underline">
          Back to your level
        </Link>
      </div>
    </div>
  );
}
