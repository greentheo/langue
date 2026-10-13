import Link from "next/link";
import { verifySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { availableLanguages, availableLevels, languageLabel } from "@/lib/vocab";
import { LEVEL_LABELS, type Level } from "@/lib/vocab/types";
import { getSummary } from "@/lib/progress";
import { updatePreferences } from "@/lib/settings-actions";
import { Panel, Stat } from "@/components/crt";
import { RichInline } from "@/components/rich-text";
import { getLevelCurriculum, levelsWithLessons, levelsWithPhrases } from "@/lib/curriculum";
import { lessonStatuses, nextLesson } from "@/lib/lessons";

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
  const lessonLevel = lessonLevels.includes(user.currentLevel as Level)
    ? (user.currentLevel as Level)
    : (lessonLevels[0] ?? null);
  const pathLessons = lessonLevel ? (getLevelCurriculum(language, lessonLevel)?.lessons ?? []) : [];
  const statuses = lessonLevel
    ? await lessonStatuses(user.id, language, lessonLevel)
    : new Map<string, { bestScore: number; completed: boolean }>();
  const upNext = nextLesson(pathLessons, statuses);
  const doneCount = pathLessons.filter((lesson) => statuses.get(lesson.id)?.completed).length;

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl crt-glow">Hello, {user.displayName}</h1>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat label="Points" value={summary.user.points.toLocaleString()} />
          <Stat label="Streak" value={`${summary.user.streakDays}d`} />
          <Stat label="Sessions" value={summary.totalSessions} />
        </div>
      </section>

      <Panel title="Course">
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
          Sessions draw on your level and everything below it.
        </p>
      </Panel>

      {upNext ? (
        <Link
          href={`/learn/lessons/${upNext.id}`}
          className="block border border-[var(--crt-accent)] px-4 py-3 no-underline hover:bg-[var(--crt-selection)]"
        >
          <span className="block text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
            {doneCount === 0 ? "Start here" : "Continue"} · {lessonLevel?.toUpperCase()} lesson{" "}
            {upNext.number} of {pathLessons.length}
          </span>
          <span className="mt-1 block text-lg text-[var(--crt-fg-bright)] crt-glow">
            {upNext.title}
          </span>
          <span className="block text-xs text-[var(--crt-fg-dim)]">
            <RichInline text={upNext.goal} />
          </span>
        </Link>
      ) : null}

      <Panel title="Learn">
        <MenuList entries={learn} />
      </Panel>

      <Panel title="Practise">
        <MenuList entries={ACTIVITIES} />
      </Panel>

      {summary.recent.length > 0 ? (
        <Panel title="Recent">
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
        </Panel>
      ) : null}

      {user.isAdmin ? (
        <p className="text-xs text-[var(--crt-fg-dim)]">
          <Link href="/learn/invites">Manage invite codes &rarr;</Link>
        </p>
      ) : null}
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
