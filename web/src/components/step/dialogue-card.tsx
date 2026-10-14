"use client";

/**
 * A role-play, one line at a time. The other person's lines appear (and are
 * spoken); at each of the learner's turns they read what to say and pick or
 * type a reply. Every turn is graded on the server, which moves the words and
 * phrases the reply uses; there is no second try — the conversation goes on
 * with the model answer, as it would in real life.
 */

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/client-api";
import { languageLabel } from "@/lib/languages";
import { CUE_MS, playCue, primeSounds } from "@/lib/sounds";
import { autoSpeak } from "@/lib/speech";
import type { PublicExercise, StepAnswerResult } from "@/lib/path/types";
import { ErrorBox } from "@/components/crt";
import { AnswerInput } from "@/components/answer-input";
import { ChoiceOptions } from "@/components/choice-options";
import { SpeakButton } from "@/components/speak-button";

type DialogueExercise = Extract<PublicExercise, { mode: "dialogue" }>;

const LABEL = "text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]";

/** Lines up to and including the next of the learner's turns after `from`. */
function revealUntil(card: DialogueExercise, from: number): number {
  for (let index = from; index < card.lines.length; index++) {
    if (card.lines[index].kind === "you") return index;
  }
  return card.lines.length - 1;
}

export function DialogueCard({
  card,
  language,
  onTurn,
  onFinish,
  busy,
}: {
  card: DialogueExercise;
  language: string;
  onTurn: (result: StepAnswerResult) => void;
  onFinish: () => void;
  busy: boolean;
}) {
  const [shown, setShown] = useState(() => revealUntil(card, 0));
  const [results, setResults] = useState<Record<number, { result: StepAnswerResult; given: string }>>({});
  const [answer, setAnswer] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const spokenRef = useRef(-1);

  const current = card.lines[shown];
  const turn = current?.kind === "you" ? current : null;
  const answered = turn ? results[shown] : undefined;
  const lastTurn = card.lines.findLastIndex((line) => line.kind === "you");
  const finished = !turn || (answered !== undefined && shown >= lastTurn);

  // Speak the other person's newest line as it appears.
  useEffect(() => {
    const latest = card.lines.slice(0, shown + 1).findLastIndex((line) => line.kind === "them");
    if (latest > spokenRef.current) {
      spokenRef.current = latest;
      const line = card.lines[latest];
      if (line.kind === "them") autoSpeak(line.target, language);
    }
  }, [card, shown, language]);

  useEffect(() => {
    if (answered || finished) nextRef.current?.focus();
    else if (turn && !turn.options) inputRef.current?.focus({ preventScroll: true });
  }, [answered, finished, turn]);

  async function submit(value: string) {
    if (!turn || answered || checking) return;
    primeSounds();
    setChecking(true);
    setError(null);
    try {
      const result = await postJson<StepAnswerResult>("/api/steps/answer", {
        itemKey: card.itemKey,
        mode: "turn",
        line: turn.line,
        typed: !turn.options,
        last: shown >= lastTurn,
        answer: value,
      });
      playCue(result.verdict === "incorrect" ? "wrong" : "right");
      window.setTimeout(() => autoSpeak(result.answers[0], language), CUE_MS);
      setResults((prev) => ({ ...prev, [shown]: { result, given: value } }));
      onTurn(result);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function next() {
    if (finished) {
      onFinish();
      return;
    }
    setAnswer("");
    setChosen(null);
    setShown(revealUntil(card, shown + 1));
  }

  return (
    <div>
      <p className={LABEL}>Role-play · {card.title}</p>
      <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">{card.setting}</p>

      <ol className="mt-5 space-y-3">
        {card.lines.slice(0, shown + 1).map((line, index) => {
          if (line.kind === "them") {
            return (
              <li key={index} className="max-w-[85%]">
                <p className={LABEL}>{card.with}</p>
                <p className="mt-1 flex items-baseline gap-2 text-lg text-[var(--crt-fg-bright)]">
                  <SpeakButton text={line.target} language={language} />
                  <span>{line.target}</span>
                </p>
                <p className="text-sm text-[var(--crt-fg-dim)]">“{line.english}”</p>
              </li>
            );
          }
          const done = results[index];
          if (!done) return null;
          const right = done.result.verdict !== "incorrect";
          return (
            <li key={index} className="ml-auto max-w-[85%] text-right">
              <p className={LABEL}>You</p>
              <p className={`mt-1 text-lg ${right ? "text-[var(--crt-fg-bright)]" : "text-[var(--crt-fg-dim)] line-through"}`}>
                {done.given || "…"}
              </p>
              {right && done.result.verdict === "correct" ? null : (
                <p className="text-sm">
                  <span className="text-[var(--crt-fg-dim)]">{right ? "Better: " : "Say: "}</span>
                  <span className="text-[var(--crt-fg-bright)]">{done.result.answers[0]}</span>
                </p>
              )}
              {done.result.note ? <p className="text-xs text-[var(--crt-fg-dim)]">{done.result.note}</p> : null}
            </li>
          );
        })}
      </ol>

      {turn && !answered ? (
        <div className="mt-6 border-t border-[var(--crt-rule)] pt-4">
          <p className={LABEL}>Your turn {turn.options ? "" : `· type it in ${languageLabel(language)}`}</p>
          <p className="mt-1 text-lg text-[var(--crt-fg-bright)]">{turn.instruction}</p>
          {turn.options ? (
            <ChoiceOptions
              options={turn.options}
              chosen={chosen}
              correct={null}
              disabled={checking}
              onPick={(option) => {
                setChosen(option);
                void submit(option);
              }}
            />
          ) : (
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(answer);
              }}
            >
              <AnswerInput
                id="dialogue-answer"
                value={answer}
                onChange={setAnswer}
                inputRef={inputRef}
                language={language}
                typing="target"
                disabled={checking}
              />
              <button type="submit" className="crt-button crt-button-primary mt-4" disabled={checking}>
                {checking ? "Checking…" : "Say it"}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {answered || finished ? (
        <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
          {answered ? (
            <p
              className={`text-sm font-bold uppercase tracking-[0.14em] ${
                answered.result.verdict === "incorrect" ? "text-[var(--crt-danger)]" : "text-[var(--crt-fg-bright)]"
              }`}
            >
              {answered.result.verdict === "correct" ? "Nice" : answered.result.verdict === "close" ? "Close enough" : "Not quite"}
              {answered.result.points > 0 ? (
                <span className="ml-2 text-[var(--crt-accent)]">+{answered.result.points}</span>
              ) : null}
              {answered.result.promoted ? (
                <span className="ml-3 normal-case tracking-normal text-[var(--crt-accent)]">★ getting stronger</span>
              ) : null}
            </p>
          ) : null}
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            disabled={busy}
            className="crt-button crt-button-primary mt-4"
          >
            {finished ? (busy ? "Saving…" : "Continue") : "Next"}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
    </div>
  );
}
