import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getLevelCurriculum, levelsWithOverview } from "@/lib/curriculum";
import { lessonStatuses, nextLesson } from "@/lib/lessons";
import { languageLabel } from "@/lib/vocab";
import { isLevel, type Level } from "@/lib/vocab/types";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { RichInline } from "@/components/rich-text";

export const metadata = { title: "Lessons — LANGUE" };

/**
 * Level overview: what the level means, the grammar it covers (ticked off as
 * lessons are completed), and the lesson path. This page is the answer to
 * "what do I need to know to pass A1?".
 */
export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const language = user.currentLanguage;
  const levels = levelsWithOverview(language);

  if (levels.length === 0) {
    return (
      <>
        <ActivityHeader title="Lessons" />
        <Panel>
          <p className="text-sm">
            There are no guided lessons for {languageLabel(language)} yet. Flashcards,
            conversation and the other practice activities all work in the meantime.
          </p>
        </Panel>
      </>
    );
  }

  const requested = (await searchParams).level;
  const pick = (value: unknown): Level | null =>
    typeof value === "string" && isLevel(value) && levels.includes(value) ? value : null;
  const level = pick(requested) ?? pick(user.currentLevel) ?? levels[0];

  const curriculum = getLevelCurriculum(language, level);
  const overview = curriculum?.overview;
  if (!curriculum || !overview) redirect("/learn");

  const lessons = curriculum.lessons;
  const statuses = await lessonStatuses(user.id, language, level);
  const upNext = nextLesson(lessons, statuses);
  const completedCount = lessons.filter((lesson) => statuses.get(lesson.id)?.completed).length;
  const lessonNumber = new Map(lessons.map((lesson) => [lesson.id, lesson.number]));

  return (
    <>
      <ActivityHeader
        title="Lessons"
        subtitle={`${languageLabel(language)} · ${level.toUpperCase()} ${overview.title}`}
      />

      <nav aria-label="Level" className="mb-6 flex flex-wrap gap-2">
        {levels.map((candidate) => (
          <Link
            key={candidate}
            href={`/learn/lessons?level=${candidate}`}
            aria-current={candidate === level ? "page" : undefined}
            className={`crt-button no-underline px-3 py-1 text-xs ${
              candidate === level ? "crt-button-primary" : ""
            }`}
          >
            {candidate.toUpperCase()}
          </Link>
        ))}
      </nav>

      <p className="text-sm leading-relaxed">
        <RichInline text={overview.summary} />
      </p>

      <Panel title={`At ${level.toUpperCase()} you can`} className="mt-6">
        <ul className="space-y-1 pl-5 text-sm list-[square] marker:text-[var(--crt-fg-dim)]">
          {overview.canDo.map((item) => (
            <li key={item}>
              <RichInline text={item} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--crt-fg-dim)]">
          Themes: {overview.themes.join(" · ")}
        </p>
      </Panel>

      <Panel
        title={lessons.length > 0 ? `Lessons (${completedCount}/${lessons.length} done)` : "Lessons"}
        className="mt-8"
      >
        {lessons.length === 0 ? (
          <p className="text-sm text-[var(--crt-fg-dim)]">
            Lessons for {level.toUpperCase()} are not written yet. The grammar checklist below
            is what this level covers.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--crt-rule)]">
            {lessons.map((lesson) => {
              const status = statuses.get(lesson.id);
              const isNext = upNext?.id === lesson.id;
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/learn/lessons/${lesson.id}`}
                    className={`-mx-2 flex items-baseline gap-4 px-2 py-3 no-underline hover:bg-[var(--crt-selection)] ${
                      isNext ? "bg-[var(--crt-selection)]" : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-[var(--crt-accent)]">
                      {String(lesson.number).padStart(2, "0")}
                    </span>
                    <span className="grow">
                      <span className="block text-[var(--crt-fg-bright)]">{lesson.title}</span>
                      <span className="block text-xs text-[var(--crt-fg-dim)]">
                        <RichInline text={lesson.subtitle ?? lesson.goal} /> · {lesson.minutes} min
                      </span>
                    </span>
                    <span className="shrink-0 text-xs">
                      {status?.completed ? (
                        <span className="text-[var(--crt-fg-bright)]">✓ {status.bestScore}%</span>
                      ) : isNext ? (
                        <span className="text-[var(--crt-accent)]">▸ next</span>
                      ) : status ? (
                        <span className="text-[var(--crt-fg-dim)]">best {status.bestScore}%</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel title="Grammar checklist" className="mt-8">
        <ul className="space-y-2 text-sm">
          {overview.grammar.map((topic) => {
            const taught = topic.lessonIds.length > 0;
            const done = taught && topic.lessonIds.every((id) => statuses.get(id)?.completed);
            return (
              <li key={topic.topic} className="flex gap-3">
                <span
                  className={`w-4 shrink-0 ${
                    done ? "text-[var(--crt-fg-bright)]" : "text-[var(--crt-fg-dim)]"
                  }`}
                  aria-label={done ? "learned" : taught ? "not yet" : "no lesson yet"}
                >
                  {done ? "✓" : taught ? "○" : "·"}
                </span>
                <span className="grow">
                  <RichInline text={topic.topic} />
                  {taught ? (
                    <span className="ml-2 text-xs text-[var(--crt-fg-dim)]">
                      {topic.lessonIds.map((id, index) => (
                        <span key={id}>
                          {index > 0 ? ", " : ""}
                          <Link href={`/learn/lessons/${id}`}>lesson {lessonNumber.get(id)}</Link>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
