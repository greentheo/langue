"use client";

/**
 * Phrase drill: flashcard-style typing, in either direction.
 *
 * Like flashcards, only the side being shown reaches the browser. After each
 * answer the server reveals the whole phrase with its usage note and literal
 * breakdown, which is where the structure of the language starts to show.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, type ActivityContext } from "@/lib/client-api";
import { useReportProgress } from "@/lib/use-report-progress";
import { useStableContext } from "@/lib/use-stable-context";
import { languageLabel } from "@/lib/languages";
import { ErrorBox } from "@/components/crt";
import { Loading, ProgressDots, SessionSummary } from "@/components/activity-shell";
import { AnswerInput } from "@/components/answer-input";
import { RichInline } from "@/components/rich-text";
import { SpeakButton } from "@/components/speak-button";
import { autoSpeak, stopSpeaking } from "@/lib/speech";

type Direction = "to-english" | "to-target";

interface Card {
  id: string;
  situation: string;
  prompt: string;
}

interface PhraseResult {
  verdict: "correct" | "close" | "incorrect";
  score: number;
  points: number;
  note: string | null;
  display: string;
  target: string[];
  english: string[];
  phraseNote: string | null;
  literally: string | null;
}

const ROUND_SIZE = 10;

export function PhrasePractice({
  context: contextProp,
  situations,
}: {
  context: ActivityContext;
  situations: { id: string; title: string; count: number }[];
}) {
  const context = useStableContext(contextProp);
  const report = useReportProgress();
  const label = languageLabel(context.language);

  const [direction, setDirection] = useState<Direction>("to-english");
  const [situation, setSituation] = useState("all");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [dealing, setDealing] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<PhraseResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, points: 0 });
  const [done, setDone] = useState(false);

  const outcomes = useRef<{ word: string; correct: boolean }[]>([]);
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const deal = useCallback(async () => {
    setDealing(true);
    setError(null);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setTally({ correct: 0, points: 0 });
    setDone(false);
    outcomes.current = [];
    startedAt.current = Date.now();

    try {
      const data = await postJson<{ cards: Card[] }>("/api/phrases", {
        ...context,
        direction,
        situation,
        count: ROUND_SIZE,
      });
      setCards(data.cards);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setDealing(false);
    }
  }, [context, direction, situation]);

  useEffect(() => {
    if (!cards || done) return;
    if (result) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [cards, index, result, done]);

  // Speak the target language as it appears: the prompt when it is the
  // phrase, or the phrase once revealed when the prompt was English.
  useEffect(() => {
    if (!cards || done || dealing || direction !== "to-english") return;
    autoSpeak(cards[index]?.prompt, context.language);
  }, [cards, index, done, dealing, direction, context.language]);

  useEffect(() => {
    if (result && direction === "to-target") autoSpeak(result.target[0], context.language);
  }, [result, direction, context.language]);

  useEffect(() => stopSpeaking, []);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (!cards || result || checking) return;

    setChecking(true);
    setError(null);
    try {
      const data = await postJson<PhraseResult>("/api/phrases/answer", {
        phraseId: cards[index].id,
        direction,
        answer,
      });
      setResult(data);
      const right = data.verdict !== "incorrect";
      outcomes.current.push({ word: data.target[0], correct: right });
      setTally((prev) => ({ correct: prev.correct + (right ? 1 : 0), points: prev.points + data.points }));
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
      void report(context, {
        activityType: "phrases",
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
    setResult(null);
  }

  // Setup screen: pick a direction and a situation.
  if (!cards) {
    return (
      <div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[12rem]">
            <label className="crt-label" htmlFor="phrase-direction">
              Direction
            </label>
            <select
              id="phrase-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as Direction)}
              className="crt-input"
            >
              <option value="to-english">{label} → English</option>
              <option value="to-target">English → {label}</option>
            </select>
          </div>
          <div className="min-w-[12rem]">
            <label className="crt-label" htmlFor="phrase-situation">
              Situation
            </label>
            <select
              id="phrase-situation"
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
              className="crt-input"
            >
              <option value="all">All situations</option>
              {situations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void deal()}
            disabled={dealing}
            className="crt-button crt-button-primary"
          >
            {dealing ? "Dealing…" : "Start"}
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--crt-fg-dim)]">
          {ROUND_SIZE} phrases per round. Start with {label} → English; once those feel easy,
          switch direction — producing the phrase yourself is the harder, more useful skill.
        </p>
        {error ? (
          <div className="mt-4">
            <ErrorBox message={error} />
          </div>
        ) : null}
      </div>
    );
  }

  if (dealing) return <Loading label="Dealing" />;

  if (done) {
    return (
      <div>
        <SessionSummary
          correct={tally.correct}
          total={cards.length}
          points={tally.points}
          onRestart={() => void deal()}
        />
        <button
          type="button"
          onClick={() => setCards(null)}
          className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)] hover:text-[var(--crt-accent)]"
        >
          Change direction or situation
        </button>
      </div>
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
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]">
          {card.situation} · {direction === "to-english" ? `${label} → English` : `English → ${label}`}
        </p>
        <ProgressDots total={cards.length} current={index} />
      </div>

      <p className="mt-2 flex items-baseline gap-2 text-2xl text-[var(--crt-fg-bright)] crt-glow break-words">
        {card.prompt}
        {direction === "to-english" ? <SpeakButton text={card.prompt} language={context.language} /> : null}
      </p>

      <form onSubmit={check} className="mt-5">
        <AnswerInput
          id="phrase-answer"
          value={answer}
          onChange={setAnswer}
          inputRef={inputRef}
          language={context.language}
          typing={direction === "to-target" ? "target" : "english"}
          disabled={Boolean(result) || checking}
          label={direction === "to-target" ? `In ${label}` : "In English"}
        />
        {!result ? (
          <button type="submit" className="crt-button crt-button-primary mt-4" disabled={checking}>
            {checking ? "Checking…" : "Check"}
          </button>
        ) : null}
      </form>

      {result ? (
        <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
          <p className={`text-sm font-bold uppercase tracking-[0.14em] ${verdictColor}`}>
            {result.verdict === "correct" ? "Correct" : result.verdict === "close" ? "Close" : "Not quite"}
            {result.points > 0 ? <span className="ml-2 text-[var(--crt-accent)]">+{result.points}</span> : null}
          </p>
          {result.note ? <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{result.note}</p> : null}

          <p className="mt-3 flex items-baseline gap-2 text-lg text-[var(--crt-fg-bright)]">
            {result.display}
            <SpeakButton text={result.target[0]} language={context.language} />
          </p>
          <p className="text-sm">{result.english.join(" · ")}</p>
          {result.literally ? (
            <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">
              Literally: <RichInline text={result.literally} />
            </p>
          ) : null}
          {result.phraseNote ? (
            <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">
              <RichInline text={result.phraseNote} />
            </p>
          ) : null}

          <button ref={nextRef} type="button" onClick={advance} className="crt-button crt-button-primary mt-4">
            {index + 1 >= cards.length ? "Finish" : "Next"}
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
