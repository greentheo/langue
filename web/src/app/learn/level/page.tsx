import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLevelCurriculum } from "@/lib/curriculum";
import { languageLabel } from "@/lib/languages";
import { LEVEL_LABELS, type Level } from "@/lib/vocab/types";
import { getCourse } from "@/lib/path/course";
import { firstOpenUnit } from "@/lib/path/planner";
import {
  daysToFinish,
  LEVEL_HOURS,
  levelAchievement,
  levelProgress,
  levelsOf,
  type Bar,
} from "@/lib/path/levels";
import { loadMarks, loadStates, rememberProgress, seedFromLessons } from "@/lib/path/store";
import { Panel } from "@/components/crt";

export const metadata = { title: "Your level — LANGUE" };

/** Days of practice the pace is measured over. */
const PACE_DAYS = 14;

function hoursAndMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function timeLeft(days: number): string {
  if (days <= 10) return `about ${days} day${days === 1 ? "" : "s"}`;
  if (days <= 70) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

/**
 * How far along a CEFR level the learner is: one bar each for words,
 * phrases, grammar and speaking, every unit with its level-up challenge, time
 * practised against the rough hours the level takes, and what the level
 * means. Every bar counts best stages, so nothing here ever goes down.
 */
export default async function LevelPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const language = user.currentLanguage;
  const languageName = languageLabel(language);
  const course = getCourse(language);
  const levels = levelsOf(course);
  if (levels.length === 0) {
    return (
      <Panel title="Your level">
        <p className="text-sm">The guided path isn&apos;t ready for {languageName} yet.</p>
      </Panel>
    );
  }

  const now = new Date();
  await seedFromLessons(user.id, language, course, now);
  const [states, marks] = await Promise.all([loadStates(user.id, language), loadMarks(user.id)]);

  const requested = (await searchParams).level;
  const open = course.units[Math.min(firstOpenUnit(course, states), course.units.length - 1)];
  const level = typeof requested === "string" && levels.includes(requested) ? requested : open.level;
  const progress = levelProgress(course, states, level, marks);
  await rememberProgress(user.id, progress.units, marks, now);
  const overview = getLevelCurriculum(language, level)?.overview;
  const label = `${level.toUpperCase()} ${LEVEL_LABELS[level as Level] ?? ""}`.trim();

  const since = new Date(now.getTime() - PACE_DAYS * 24 * 60 * 60 * 1000);
  const [total, recent, finished] = await Promise.all([
    prisma.activityLog.aggregate({ where: { userId: user.id, language, level }, _sum: { durationSec: true } }),
    prisma.activityLog.aggregate({
      where: { userId: user.id, language, completedAt: { gte: since } },
      _sum: { durationSec: true },
    }),
    prisma.achievement.findUnique({
      where: { userId_name: { userId: user.id, name: levelAchievement(language, level) } },
    }),
  ]);
  const practised = total._sum.durationSec ?? 0;
  const minutesPerDay = (recent._sum.durationSec ?? 0) / 60 / PACE_DAYS;
  const days = daysToFinish(progress.percent, practised / 3600, minutesPerDay);
  const guide = LEVEL_HOURS[level];

  return (
    <div className="space-y-8">
      <div>
        <p className="crt-label">Your level</p>
        <h1 className="mt-1 text-2xl crt-glow">
          {languageName} {label}
        </h1>
        {levels.length > 1 ? (
          <p className="mt-2 flex gap-3 text-xs">
            {levels.map((other) => (
              <Link key={other} href={`/learn/level?level=${other}`} className={other === level ? "text-[var(--crt-fg-bright)]" : ""}>
                {other.toUpperCase()}
              </Link>
            ))}
          </p>
        ) : null}
      </div>

      <div>
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-[var(--crt-fg-bright)]">
            {progress.complete ? `★ ${level.toUpperCase()} complete` : `${progress.percent}% of ${level.toUpperCase()}`}
          </span>
          <span className="text-[var(--crt-fg-dim)]">
            {progress.units.filter((unit) => unit.complete).length} of {progress.units.length} units
          </span>
        </p>
        <div className="mt-2 h-4 border border-[var(--crt-rule)]">
          <div className="h-full bg-[var(--crt-accent)]" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="mt-3 text-sm">
          You&apos;ve practised {hoursAndMinutes(practised)} at {level.toUpperCase()}.
          {guide ? ` Most people take about ${guide} hours — a guide, not a rule.` : ""}
          {days !== null && !progress.complete
            ? ` At your pace (about ${Math.max(1, Math.round(minutesPerDay))} min a day), ${timeLeft(days)} to go.`
            : ""}
        </p>
        {finished ? (
          <p className="mt-3 text-sm">
            <Link href={`/learn/level/certificate?level=${level}`}>★ See your certificate &rarr;</Link>
          </p>
        ) : null}
      </div>

      <Panel title="What you know">
        <div className="space-y-4">
          <BarRow name="Words" bar={progress.words} unit="learned" />
          <BarRow name="Phrases" bar={progress.phrases} unit="learned" />
          <BarRow name="Grammar" bar={progress.grammar} unit="ideas learned" />
          <BarRow name="Speaking" bar={progress.speaking} unit="conversations" />
        </div>
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
          Learned means you can produce it — type the word, build the phrase, answer the idea&apos;s
          questions — on more than one day. Bars never go backwards.
        </p>
      </Panel>

      <Panel title={`Units · ${level.toUpperCase()}`}>
        <ol className="space-y-4">
          {progress.units.map((unit) => (
            <li key={unit.id}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span>
                  <span className={unit.complete ? "text-[var(--crt-accent)]" : "text-[var(--crt-fg-dim)]"}>
                    {unit.code}
                  </span>{" "}
                  <span className="text-[var(--crt-fg-bright)]">{unit.title}</span>
                  {unit.complete ? <span className="ml-2 text-[var(--crt-accent)]">✓</span> : null}
                </span>
                {unit.complete ? (
                  <span className="text-xs text-[var(--crt-fg-dim)]">complete</span>
                ) : (
                  <Link href={`/learn/step?challenge=${unit.id}`} className="text-xs">
                    {unit.started ? "Level-up challenge" : "Test out"} &rarr;
                  </Link>
                )}
              </p>
              <div className="mt-1 h-2 border border-[var(--crt-rule)]">
                <div className="h-full bg-[var(--crt-accent)]" style={{ width: `${unit.percent}%` }} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
          Two ways to finish a unit: learn everything in it, or take its challenge — about 15 questions,
          get 8 in 10 right and it&apos;s done. A miss costs nothing, and you can try again straight away.
          Already know some {languageName}? Test out of the units you know.
        </p>
      </Panel>

      {overview ? (
        <Panel title={`By the end of ${level.toUpperCase()} you can`}>
          <ul className="space-y-1 text-sm">
            {overview.canDo.map((item) => (
              <li key={item} className="flex gap-2">
                <span className={progress.complete ? "text-[var(--crt-accent)]" : "text-[var(--crt-fg-dim)]"}>
                  {progress.complete ? "✓" : "·"}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <p className="text-xs">
        <Link href="/learn">&larr; Home</Link>
      </p>
    </div>
  );
}

function BarRow({ name, bar, unit }: { name: string; bar: Bar; unit: string }) {
  return (
    <div>
      <p className="flex items-baseline justify-between text-sm">
        <span className="text-[var(--crt-fg-bright)]">{name}</span>
        <span className="text-xs text-[var(--crt-fg-dim)]">
          {bar.done} of {bar.total} {unit}
        </span>
      </p>
      <div className="mt-1 h-2 border border-[var(--crt-rule)]">
        <div className="h-full bg-[var(--crt-accent)]" style={{ width: `${bar.percent}%` }} />
      </div>
    </div>
  );
}
