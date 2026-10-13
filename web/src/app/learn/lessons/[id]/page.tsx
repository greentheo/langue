import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getLesson, getLevelCurriculum, publicPracticeItem } from "@/lib/curriculum";
import { lessonStatuses } from "@/lib/lessons";
import { languageLabel } from "@/lib/vocab";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { RichInline, RichText } from "@/components/rich-text";
import { SpeakButton } from "@/components/speak-button";
import { LessonPractice } from "@/components/lesson/lesson-practice";
import { AskTutor } from "@/components/lesson/ask-tutor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const lesson = getLesson((await params).id);
  return { title: lesson ? `${lesson.title} — LANGUE` : "Lesson — LANGUE" };
}

/**
 * One lesson: goal, explanation, words, practice, and a box for questions.
 * The explanation renders on the server; practice and questions are the only
 * client components, and practice receives prompts without their answers.
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const lesson = getLesson((await params).id);
  if (!lesson) notFound();

  const path = getLevelCurriculum(lesson.language, lesson.level)?.lessons ?? [lesson];
  const position = path.findIndex((candidate) => candidate.id === lesson.id);
  const previous = position > 0 ? path[position - 1] : null;
  const next = position >= 0 && position + 1 < path.length ? path[position + 1] : null;

  const status = (await lessonStatuses(user.id, lesson.language, lesson.level)).get(lesson.id);
  const language = lesson.language;

  return (
    <>
      <ActivityHeader
        title={lesson.title}
        subtitle={[
          `${languageLabel(language)} ${lesson.level.toUpperCase()}`,
          `lesson ${lesson.number} of ${path.length}`,
          `${lesson.minutes} min`,
          status?.completed ? `completed · best ${status.bestScore}%` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {lesson.subtitle ? (
        <p className="-mt-3 mb-5 text-sm text-[var(--crt-fg-dim)]">
          <RichInline text={lesson.subtitle} />
        </p>
      ) : null}

      <div className="border border-[var(--crt-accent)] px-4 py-3 text-sm">
        <span className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
          After this lesson you can
        </span>
        <p className="mt-1 text-[var(--crt-fg-bright)]">
          <RichInline text={lesson.goal} />
        </p>
      </div>

      {lesson.sections.map((section, index) => (
        <Panel key={index} title={section.heading} className="mt-8">
          <RichText text={section.body} className="text-sm" />

          {section.table ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {section.table.columns.map((column, columnIndex) => (
                      <th
                        key={columnIndex}
                        className="border-b border-[var(--crt-rule)] px-2 py-1 text-left text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-[var(--crt-rule)] last:border-0">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`px-2 py-1.5 align-top ${
                            cellIndex === 0 ? "text-[var(--crt-fg-dim)]" : "text-[var(--crt-fg-bright)]"
                          }`}
                        >
                          <RichInline text={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.examples && section.examples.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {section.examples.map(([target, english], exampleIndex) => (
                <li key={exampleIndex} className="flex items-baseline gap-2">
                  <SpeakButton text={target} language={language} />
                  <span>
                    <span className="text-[var(--crt-fg-bright)]">
                      <RichInline text={target} />
                    </span>
                    <span className="text-[var(--crt-fg-dim)]"> — {english}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {section.tip ? (
            <p className="mt-4 border-l-2 border-[var(--crt-accent)] pl-3 text-sm">
              <span className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
                Watch out{" "}
              </span>
              <RichInline text={section.tip} />
            </p>
          ) : null}
        </Panel>
      ))}

      {lesson.words.length > 0 ? (
        <Panel title="New words" className="mt-8">
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {lesson.words.map(([target, english]) => (
              <li key={target} className="flex items-baseline gap-2">
                <SpeakButton text={target} language={language} />
                <span className="text-[var(--crt-fg-bright)]">{target}</span>
                <span className="text-[var(--crt-fg-dim)]">{english}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Practise" className="mt-8">
        <LessonPractice
          lessonId={lesson.id}
          language={language}
          items={lesson.practice.map(publicPracticeItem)}
          nextLessonHref={next ? `/learn/lessons/${next.id}` : null}
        />
      </Panel>

      <Panel title="Ask about this lesson" className="mt-8">
        <p className="mb-3 text-xs text-[var(--crt-fg-dim)]">
          Stuck on something? The tutor answers with this lesson in mind.
        </p>
        <AskTutor lessonId={lesson.id} example="e.g. Can you explain the table more simply?" />
      </Panel>

      <nav className="mt-8 flex flex-wrap justify-between gap-3 text-sm">
        {previous ? (
          <Link href={`/learn/lessons/${previous.id}`}>&larr; {previous.title}</Link>
        ) : (
          <span />
        )}
        <Link href={`/learn/lessons?level=${lesson.level}`}>All lessons</Link>
        {next ? <Link href={`/learn/lessons/${next.id}`}>{next.title} &rarr;</Link> : <span />}
      </nav>
    </>
  );
}
