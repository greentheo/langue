"use client";

/**
 * Flashcards.
 *
 * The card's translations never reach the browser until the answer is
 * submitted — the server deals prompts and grades responses. That also means a
 * round works with the Anthropic API completely down: grading is local string
 * comparison, and only the optional explanation on a miss needs the model.
 *
 * Two modes: multiple choice (the default — four options to click, easiest
 * for beginners and kids) and typing the answer. The choice is remembered per
 * browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, reportProgress, type ActivityContext } from "@/lib/client-api";
import { ErrorBox, Panel } from "@/components/crt";
import { ChoiceOptions } from "@/components/choice-options";
import {
  ActivityHeader,
  Loading,
  ProgressDots,
  SessionSummary,
} from "@/components/activity-shell";

interface Card {
  word: string;
  category: string;
  difficulty: number;
  example: string | null;
  translationCount: number;
  options: string[] | null;
}

type Mode = "choice" | "type";

const MODE_KEY = "langue.flashcards.mode";

interface AnswerResult {
  verdict: "correct" | "close" | "incorrect";
  score: number;
  points: number;
  note: string | null;
  translations: string[];
  example: string | null;
  explanation: string | null;
}

const ROUND_SIZE = 10;

export function Flashcards({ context }: { context: ActivityContext }) {
  // null until the saved preference has been read, so the first deal uses it.
  const [mode, setMode] = useState<Mode | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, points: 0 });
  const [done, setDone] = useState(false);

  const outcomes = useRef<{ word: string; correct: boolean }[]>([]);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(MODE_KEY);
    } catch {
      // Storage blocked (private mode); the default stands.
    }
    setMode(saved === "type" ? "type" : "choice");
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Not remembered, but the switch still applies to this visit.
    }
    setMode(next);
  }

  const deal = useCallback(async () => {
    if (!mode) return;
    setCards(null);
    setChosen(null);
    setError(null);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setTally({ correct: 0, points: 0 });
    setDone(false);
    outcomes.current = [];
    startedAt.current = Date.now();

    try {
      const data = await postJson<{ cards: Card[] }>("/api/flashcards", {
        ...context,
        count: ROUND_SIZE,
        mode,
      });
      setCards(data.cards);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [context, mode]);

  useEffect(() => {
    void deal();
  }, [deal]);

  // Return focus to the input whenever a new card is shown.
  useEffect(() => {
    if (!result && cards) inputRef.current?.focus();
  }, [index, result, cards]);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    await submit(answer);
  }

  async function submit(value: string) {
    if (!cards || result || checking || !mode) return;

    setChecking(true);
    setError(null);

    try {
      const data = await postJson<AnswerResult>("/api/flashcards/answer", {
        ...context,
        word: cards[index].word,
        answer: value,
        mode,
      });

      setResult(data);
      const wasCorrect = data.verdict !== "incorrect";
      outcomes.current.push({ word: cards[index].word, correct: wasCorrect });
      setTally((prev) => ({
        correct: prev.correct + (wasCorrect ? 1 : 0),
        points: prev.points + data.points,
      }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function advance() {
    if (!cards) return;

    if (index + 1 >= cards.length) {
      setDone(true);
      void reportProgress(context, {
        activityType: "flashcards",
        pointsEarned: tally.points,
        itemsTotal: cards.length,
        itemsCorrect: tally.correct,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        words: outcomes.current,
      });
      return;
    }

    setIndex((prev) => prev + 1);
    setAnswer("");
    setChosen(null);
    setResult(null);
  }

  const modeToggle = (
    <div className="flex gap-1" role="group" aria-label="Answer mode">
      {(["choice", "type"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => switchMode(option)}
          aria-pressed={mode === option}
          className={`crt-button px-2 py-0.5 text-[0.6875rem] ${mode === option ? "crt-button-primary" : ""}`}
        >
          {option === "choice" ? "Multiple choice" : "Type it"}
        </button>
      ))}
    </div>
  );

  if (error && !cards) {
    return (
      <>
        <ActivityHeader title="Flashcards" />
        <ErrorBox message={error} />
        <button type="button" onClick={() => void deal()} className="crt-button mt-4">
          Retry
        </button>
      </>
    );
  }

  if (!cards) {
    return (
      <>
        <ActivityHeader title="Flashcards" />
        <Loading label="Dealing" />
      </>
    );
  }

  if (done) {
    return (
      <>
        <ActivityHeader title="Flashcards" />
        <SessionSummary
          correct={tally.correct}
          total={cards.length}
          points={tally.points}
          onRestart={() => void deal()}
        />
      </>
    );
  }

  const card = cards[index];
  const verdictColor =
    result?.verdict === "correct"
      ? "text-[var(--crt-fg-bright)]"
      : result?.verdict === "close"
        ? "text-[var(--crt-accent)]"
        : "text-[var(--crt-danger)]";

  return (
    <>
      <ActivityHeader title="Flashcards" subtitle={`${card.category} · difficulty ${card.difficulty}`}>
        <ProgressDots total={cards.length} current={index} />
      </ActivityHeader>
      <div className="-mt-3 mb-4">{modeToggle}</div>

      <Panel>
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]">
          Translate
        </p>
        <p className="mt-2 text-3xl text-[var(--crt-fg-bright)] crt-glow break-words">
          {card.word}
        </p>
        {card.example ? (
          <p className="mt-3 text-sm text-[var(--crt-fg-dim)] italic">{card.example}</p>
        ) : null}
        {card.translationCount > 1 && !card.options ? (
          <p className="mt-2 text-xs text-[var(--crt-fg-dim)]">
            {card.translationCount} accepted answers — any one will do.
          </p>
        ) : null}

        {card.options ? (
          <ChoiceOptions
            options={card.options}
            chosen={chosen}
            correct={result?.translations ?? null}
            disabled={Boolean(result) || checking}
            onPick={(option) => {
              setChosen(option);
              void submit(option);
            }}
          />
        ) : (
          <form onSubmit={check} className="mt-5">
            <label className="crt-label" htmlFor="answer">
              Your answer
            </label>
            <input
              id="answer"
              ref={inputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={Boolean(result) || checking}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="crt-input"
            />

            {!result ? (
              <button
                type="submit"
                className="crt-button crt-button-primary mt-4"
                disabled={checking}
              >
                {checking ? "Checking…" : "Check"}
              </button>
            ) : null}
          </form>
        )}

        {result ? (
          <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
            <p className={`text-sm font-bold uppercase tracking-[0.14em] ${verdictColor}`}>
              {result.verdict === "correct"
                ? "Correct"
                : result.verdict === "close"
                  ? "Close"
                  : "Not quite"}
              {result.points > 0 ? (
                <span className="ml-2 text-[var(--crt-accent)]">+{result.points}</span>
              ) : null}
            </p>

            {result.note ? (
              <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{result.note}</p>
            ) : null}

            <p className="mt-2 text-sm">
              <span className="text-[var(--crt-fg-dim)]">Means: </span>
              <span className="text-[var(--crt-fg-bright)]">
                {result.translations.join(", ")}
              </span>
            </p>

            {result.explanation ? (
              <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">{result.explanation}</p>
            ) : null}

            <button
              type="button"
              onClick={advance}
              autoFocus
              className="crt-button crt-button-primary mt-4"
            >
              {index + 1 >= cards.length ? "Finish" : "Next"}
            </button>
          </div>
        ) : null}
      </Panel>

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
    </>
  );
}
