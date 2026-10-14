import Link from "next/link";
import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { availableLanguages, availableLevels, languageLabel } from "@/lib/vocab";
import { LEVEL_LABELS, type Level } from "@/lib/vocab/types";
import { getSummary } from "@/lib/progress";
import { updatePreferences } from "@/lib/settings-actions";
import { Panel } from "@/components/crt";
import { RichInline } from "@/components/rich-text";
import { getLesson, levelsWithLessons, levelsWithPhrases } from "@/lib/curriculum";
import { groupsFor, leaderboard } from "@/lib/leaderboard";
import { getCourse } from "@/lib/path/course";
import {
  dueCount,
  firstOpenUnit,
  nextIntro,
  unitIdeas,
  unitProgress,
  type IdeaStatus,
  type UnitProgress,
} from "@/lib/path/planner";
import { loadMarks, loadStates, rememberProgress, seedFromLessons } from "@/lib/path/store";
import { levelProgress } from "@/lib/path/levels";
import { StandingsTable } from "@/components/standings-table";
import { LanguageChooser } from "@/components/language-chooser";
import { prisma } from "@/lib/db";

interface MenuEntry {
  href: string;
  key: string;
  name: string;
  blurb: string;
  disabled?: boolean;
}

const ACTIVITIES: MenuEntry[] = [
  {
    href: "/learn/flashcards",
    key: "F",
    name: "Flashcards",
    blurb: "Drill vocabulary from the level libraries. Graded instantly, no API needed.",
  },
  {
    href: "/learn/conversation",
    key: "C",
    name: "Conversation",
    blurb: "Talk with a tutor. Beginner mode adds translations and hints.",
  },
  {
    href: "/learn/fill-blank",
    key: "B",
    name: "Fill in the blank",
    blurb: "Grammar in context, generated around words you have seen.",
  },
  {
    href: "/learn/translation",
    key: "T",
    name: "Translation",
    blurb: "Translate in either direction, graded on meaning rather than wording.",
  },
  {
    href: "/learn/reading",
    key: "R",
    name: "Reading",
    blurb: "A passage with comprehension questions about that passage.",
  },
];

export default async function LearnPage() {
  const user = await verifySession();
  if (!user) redirect("/login");

  const summary = await getSummary(user.id);
  const languages = availableLanguages();
  const levels = availableLevels(user.currentLanguage);

  const language = user.currentLanguage;
  const languageName = languageLabel(language);
  const lessonLevels = levelsWithLessons(language);
  const phraseLevels = levelsWithPhrases(language);

  // The guided path: what to do next, and how far along each unit is.
  const course = getCourse(language);
  const hasPath = course.units.length > 0;
  const now = new Date();
  if (hasPath) await seedFromLessons(user.id, language, course, now);
  const states = hasPath ? await loadStates(user.id, language) : new Map();
  const marks = hasPath ? await loadMarks(user.id, course) : new Map();
  const units = unitProgress(course, states, marks);
  if (hasPath) await rememberProgress(user.id, units, marks, now);
  const currentIndex = Math.min(firstOpenUnit(course, states), Math.max(0, units.length - 1));
  const current = units[currentIndex];
  const ideas = unitIdeas(course, currentIndex, states);
  const waiting = dueCount(course, states, now);
  const upNext = nextIntro(course, states);
  const upNextIdea =
    upNext?.entry.type === "grammar" ? course.items.get(upNext.entry.key) : undefined;
  const levelUnits = current ? units.filter((unit) => unit.level === current.level) : [];
  const level = current ? levelProgress(course, states, current.level, marks) : null;

  // The home screen shows the biggest group's week, top five.
  const groups = await groupsFor(user.id);
  const board = groups[0] ? await leaderboard(groups[0].id, user.id, "week") : null;

  const learn: MenuEntry[] = [
    {
      href: "/learn/lessons",
      key: "L",
      name: "Lessons",
      blurb:
        lessonLevels.length > 0
          ? `How ${languageName} works: short explanations, then practice.`
          : `Coming soon for ${languageName}. Overviews of each level are already there.`,
    },
    {
      href: "/learn/phrases",
      key: "P",
      name: "Phrases",
      blurb:
        phraseLevels.length > 0
          ? "Ready-made phrases by situation. Browse, listen, and drill both ways."
          : `Coming soon for ${languageName}.`,
      disabled: phraseLevels.length === 0,
    },
  ];

  const started = states.size > 0;
  // Before a new learner's first step anywhere, ask what they want to learn
  // rather than starting them on whichever language sorts first.
  const brandNew =
    !started &&
    (await prisma.itemProgress.count({ where: { userId: user.id } })) === 0 &&
    (await prisma.activityLog.count({ where: { userId: user.id } })) === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl crt-glow">Hello, {user.displayName}</h1>
        {brandNew ? null : (
          <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">
            Learning {languageName} &middot; <Link href="/learn/language">change language</Link>
          </p>
        )}
      </div>

      {brandNew ? (
        <Panel title="What do you want to learn?">
          <LanguageChooser current={language} />
          <p className="mt-3 text-xs text-[var(--crt-fg-dim)]">
            Pick one, then press Start. You can switch any time from the top of the page.
          </p>
        </Panel>
      ) : null}

      {hasPath && current ? (
        <>
          {level?.complete ? (
            <div className="border-2 border-double border-[var(--crt-accent)] px-5 py-4">
              <p className="text-lg text-[var(--crt-fg-bright)] crt-glow">
                ★ You finished {languageName} {current.level.toUpperCase()}
              </p>
              <p className="mt-1 text-sm">
                <Link href={`/learn/level/certificate?level=${current.level}`}>See your certificate &rarr;</Link>
              </p>
              {current.index === units.length - 1 ? (
                <p className="mt-2 text-xs text-[var(--crt-fg-dim)]">
                  The next level is on its way. Until then, steps keep everything you&apos;ve learned fresh.
                </p>
              ) : null}
            </div>
          ) : null}
          <Link
            href="/learn/step"
            className="block border-2 border-[var(--crt-accent)] px-5 py-4 no-underline hover:bg-[var(--crt-selection)]"
          >
            <span className="block text-2xl text-[var(--crt-fg-bright)] crt-glow">
              ▶ {started ? "Continue" : `Start ${languageName}`}
            </span>
            <span className="mt-1 block text-sm text-[var(--crt-fg)]">
              {current.code} · {current.title} · about 3 minutes
            </span>
            <span className="mt-1 block text-xs text-[var(--crt-fg-dim)]">
              {upNextIdea?.kind === "grammar" ? (
                <>
                  Next new idea: <RichInline text={upNextIdea.heading} />
                  {waiting > 0 ? ` · ${waiting} to review` : ""}
                </>
              ) : waiting > 0 ? (
                `${waiting} to review`
              ) : (
                "New words and phrases"
              )}
            </span>
          </Link>

          <Panel title={`Your path · ${languageName} ${current.level.toUpperCase()}`}>
            {level ? (
              <p className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="text-[var(--crt-fg-bright)]">
                    {level.complete ? "★ complete" : `${level.percent}% of ${current.level.toUpperCase()}`}
                  </span>
                  <span className="text-[var(--crt-fg-dim)]">
                    {" "}· {level.words.done} words · {level.phrases.done} phrases · {level.speaking.done}{" "}
                    conversations
                  </span>
                </span>
                <Link href="/learn/level" className="text-xs">
                  Your level &rarr;
                </Link>
              </p>
            ) : null}
            <ol className="space-y-3">
              {levelUnits.map((unit) => (
                <li key={unit.id}>
                  <UnitRow unit={unit} current={unit.index === currentIndex} />
                  {unit.index === currentIndex ? (
                    <>
                      <IdeaList ideas={ideas} />
                      {!unit.complete ? (
                        <p className="mt-2 ml-1 text-xs text-[var(--crt-fg-dim)]">
                          Know this already?{" "}
                          <Link href={`/learn/step?challenge=${unit.id}`}>Take the {unit.code} challenge &rarr;</Link>
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">
              A unit is complete when you can produce everything in it on more than one day — or
              when you pass its challenge. Progress never goes backwards.
            </p>
          </Panel>
        </>
      ) : (
        <Panel title="Guided path">
          <p className="text-sm">
            The guided path isn&apos;t ready for {languageName} yet. Everything below works.
          </p>
        </Panel>
      )}

      {board && groups[0] ? (
        <Panel title={`This week · ${groups[0].name}`}>
          <StandingsTable
            rows={[
              ...board.slice(0, 5),
              // Always show where you are, even below the top five.
              ...board.slice(5).filter((row) => row.userId === user.id),
            ]}
            period="week"
            viewerId={user.id}
            compact
          />
          <p className="mt-3 text-xs">
            <Link href="/learn/leaderboard">Full leaderboard &rarr;</Link>
          </p>
        </Panel>
      ) : null}

      <details className="crt-panel p-5" open={!hasPath}>
        <summary className="cursor-pointer text-sm uppercase tracking-[0.18em] text-[var(--crt-fg-bright)]">
          More practice
        </summary>
        <p className="mt-2 text-xs text-[var(--crt-fg-dim)]">
          Pick your own activity: read whole lessons, browse phrases, drill, or talk with the tutor.
        </p>

        <h3 className="mt-5 crt-label">Learn</h3>
        <MenuList entries={learn} />

        <h3 className="mt-5 crt-label">Practise</h3>
        <MenuList entries={ACTIVITIES} />

        <h3 className="mt-5 crt-label">Course</h3>
        <form action={updatePreferences} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[10rem]">
            <label className="crt-label" htmlFor="language">
              Language
            </label>
            <select
              id="language"
              name="language"
              defaultValue={user.currentLanguage}
              className="crt-input"
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {languageLabel(language)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[10rem]">
            <label className="crt-label" htmlFor="level">
              Level
            </label>
            <select
              id="level"
              name="level"
              defaultValue={user.currentLevel}
              className="crt-input"
            >
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()} — {LEVEL_LABELS[level as Level]}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="crt-button">
            Set
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--crt-fg-dim)]">
          The level sets what the activities above draw on. The guided path keeps its own place.
        </p>

        {summary.recent.length > 0 ? (
          <>
            <h3 className="mt-5 crt-label">Recent</h3>
            <ul className="space-y-1 text-xs">
              {summary.recent.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span className="text-[var(--crt-fg-dim)]">
                    {entry.completedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                  <span>
                    {entry.activityType.replace("_", " ")} &middot;{" "}
                    {languageLabel(entry.language)} {entry.level.toUpperCase()}
                  </span>
                  <span className="text-[var(--crt-fg-bright)]">
                    {entry.itemsCorrect}/{entry.itemsTotal} &middot; +{entry.pointsEarned}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </details>

      {user.isAdmin ? (
        <p className="text-xs text-[var(--crt-fg-dim)]">
          <Link href="/learn/invites">Manage invite codes &rarr;</Link>
        </p>
      ) : null}
    </div>
  );
}

const IDEA_MARK: Record<IdeaStatus, string> = { new: "○", learning: "◐", learned: "★" };

function UnitRow({ unit, current }: { unit: UnitProgress; current: boolean }) {
  const percent = unit.percent;
  return (
    <div className={current ? "" : "opacity-80"}>
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <span className={current ? "text-[var(--crt-accent)]" : "text-[var(--crt-fg-dim)]"}>
            {unit.code}
          </span>{" "}
          <span className={current ? "text-[var(--crt-fg-bright)]" : ""}>{unit.title}</span>
          {unit.complete ? <span className="ml-2 text-[var(--crt-accent)]">✓</span> : null}
          {current ? (
            <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
              you are here
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-[var(--crt-fg-dim)]">
          {unit.started || unit.complete ? `${percent}%` : ""}
        </span>
      </p>
      <div className="mt-1 h-1.5 border border-[var(--crt-rule)]">
        <div className="h-full bg-[var(--crt-accent)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function IdeaList({ ideas }: { ideas: ReturnType<typeof unitIdeas> }) {
  // Grouped by lesson, with a link to read each one whole.
  const lessons = [...new Set(ideas.map((idea) => idea.lessonId))];
  return (
    <div className="mt-3 space-y-3 border-l border-[var(--crt-rule)] pl-4">
      {lessons.map((lessonId) => {
        const lesson = getLesson(lessonId);
        return (
          <div key={lessonId} className="text-sm">
            <p className="text-xs text-[var(--crt-fg-dim)]">
              {lesson?.title}{" "}
              <Link href={`/learn/lessons/${lessonId}`} className="ml-1">
                read the whole lesson
              </Link>
            </p>
            <ul className="mt-1 space-y-0.5">
              {ideas
                .filter((idea) => idea.lessonId === lessonId)
                .map((idea) => (
                  <li key={idea.key} title={idea.status}>
                    <span
                      className={
                        idea.status === "new" ? "text-[var(--crt-fg-dim)]" : "text-[var(--crt-accent)]"
                      }
                      aria-label={idea.status}
                    >
                      {IDEA_MARK[idea.status]}
                    </span>{" "}
                    <span className={idea.status === "new" ? "text-[var(--crt-fg-dim)]" : ""}>
                      <RichInline text={idea.heading} />
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MenuList({ entries }: { entries: MenuEntry[] }) {
  return (
    <ul className="divide-y divide-[var(--crt-rule)]">
      {entries.map((entry) => (
        <li key={entry.href}>
          {entry.disabled ? (
            <div className="flex gap-4 py-3 px-2 -mx-2 opacity-50">
              <span className="text-[var(--crt-fg-dim)] font-bold w-5 shrink-0">{entry.key}</span>
              <span>
                <span className="block">{entry.name}</span>
                <span className="block text-xs text-[var(--crt-fg-dim)]">{entry.blurb}</span>
              </span>
            </div>
          ) : (
            <Link
              href={entry.href}
              className="flex gap-4 py-3 no-underline hover:bg-[var(--crt-selection)] px-2 -mx-2"
            >
              <span className="text-[var(--crt-accent)] font-bold w-5 shrink-0">{entry.key}</span>
              <span>
                <span className="block text-[var(--crt-fg-bright)]">{entry.name}</span>
                <span className="block text-xs text-[var(--crt-fg-dim)]">{entry.blurb}</span>
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
