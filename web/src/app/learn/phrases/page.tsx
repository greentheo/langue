import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getLevelCurriculum, levelsWithPhrases } from "@/lib/curriculum";
import { languageLabel } from "@/lib/vocab";
import { isLevel, type Level } from "@/lib/vocab/types";
import { Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";
import { RichInline } from "@/components/rich-text";
import { SpeakButton } from "@/components/speak-button";
import { PhrasePractice } from "@/components/activities/phrase-practice";

export const metadata = { title: "Phrases — LANGUE" };

/**
 * The level's phrasebook: browse it (with audio, notes and literal glosses) or
 * drill it in either direction.
 */
export default async function PhrasesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[]; mode?: string | string[] }>;
}) {
  const user = await verifySession();
  if (!user) redirect("/login");

  const language = user.currentLanguage;
  const levels = levelsWithPhrases(language);

  if (levels.length === 0) {
    return (
      <>
        <ActivityHeader title="Phrases" />
        <Panel>
          <p className="text-sm">
            There is no phrasebook for {languageLabel(language)} yet. Flashcards and
            conversation work in the meantime.
          </p>
        </Panel>
      </>
    );
  }

  const query = await searchParams;
  const pick = (value: unknown): Level | null =>
    typeof value === "string" && isLevel(value) && levels.includes(value) ? value : null;
  const level = pick(query.level) ?? pick(user.currentLevel) ?? levels[0];
  const practising = query.mode === "practice";

  const situations = getLevelCurriculum(language, level)?.situations ?? [];
  const phraseCount = situations.reduce((sum, situation) => sum + situation.phrases.length, 0);

  const tab = (mode: "browse" | "practice", text: string) => {
    const active = practising === (mode === "practice");
    return (
      <Link
        href={`/learn/phrases?level=${level}${mode === "practice" ? "&mode=practice" : ""}`}
        aria-current={active ? "page" : undefined}
        className={`crt-button no-underline px-3 py-1 text-xs ${active ? "crt-button-primary" : ""}`}
      >
        {text}
      </Link>
    );
  };

  return (
    <>
      <ActivityHeader
        title="Phrases"
        subtitle={`${languageLabel(language)} · ${level.toUpperCase()} · ${phraseCount} phrases`}
      />

      <nav aria-label="Phrases" className="mb-6 flex flex-wrap items-center gap-2">
        {tab("browse", "Phrasebook")}
        {tab("practice", "Practise")}
        {levels.length > 1 ? (
          <span className="ml-4 flex gap-2">
            {levels.map((candidate) => (
              <Link
                key={candidate}
                href={`/learn/phrases?level=${candidate}${practising ? "&mode=practice" : ""}`}
                className={candidate === level ? "text-[var(--crt-accent)]" : ""}
              >
                {candidate.toUpperCase()}
              </Link>
            ))}
          </span>
        ) : null}
      </nav>

      {practising ? (
        <Panel>
          <PhrasePractice
            context={{ language, level }}
            situations={situations.map((situation) => ({
              id: situation.id,
              title: situation.title,
              count: situation.phrases.length,
            }))}
          />
        </Panel>
      ) : (
        <>
          <p className="text-sm text-[var(--crt-fg-dim)]">
            Ready-made phrases for getting by at {level.toUpperCase()}. Tap ▶ to hear one. The
            literal breakdowns show how each phrase is built — the lessons explain why.
          </p>
          <nav aria-label="Situations" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {situations.map((situation) => (
              <a key={situation.id} href={`#${situation.id}`}>
                {situation.title}
              </a>
            ))}
          </nav>

          {situations.map((situation) => (
            <div key={situation.id} id={situation.id} className="scroll-mt-6">
              <Panel title={situation.title} className="mt-8">
                <ul className="divide-y divide-[var(--crt-rule)]">
                  {situation.phrases.map((phrase) => (
                    <li key={phrase.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="flex items-baseline gap-1 text-[var(--crt-fg-bright)]">
                          <SpeakButton text={phrase.target[0]} language={language} />
                          {phrase.display}
                        </span>
                        <span className="text-sm">{phrase.english[0]}</span>
                      </div>
                      {phrase.literally || phrase.note ? (
                        <p className="mt-0.5 pl-6 text-xs text-[var(--crt-fg-dim)]">
                          {phrase.literally ? (
                            <span>
                              lit. <RichInline text={phrase.literally} />
                            </span>
                          ) : null}
                          {phrase.literally && phrase.note ? " · " : null}
                          {phrase.note ? <RichInline text={phrase.note} /> : null}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ))}
        </>
      )}
    </>
  );
}
