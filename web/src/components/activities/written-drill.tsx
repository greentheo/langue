"use client";

/**
 * Fill-in-the-blank and translation.
 *
 * One component: both are "read a prompt, type an answer, get graded, repeat",
 * differing only in how the prompt is rendered and how the answer is graded
 * (locally for a single-token blank, by the model for an open translation).
 * Splitting them into two near-identical files is how the Python CLI ended up
 * with 959 lines in fill_blank.py and 477 in translation.py.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, reportProgress, type ActivityContext } from "@/lib/client-api";
import { ErrorBox, Panel } from "@/components/crt";
import {
  ActivityHeader,
  Loading,
  ProgressDots,
  SessionSummary,
} from "@/components/activity-shell";

export type DrillKind = "fill_blank" | "translation";

interface FillBlankExercise {
  sentence: string;
  answer: string;
  hint: string;
  translation: string;
}

interface TranslationExercise {
  prompt: string;
  answer: string;
  alternatives: string[];
  note: string;
}

interface Grade {
  correct: boolean;
  verdict: "correct" | "close" | "incorrect";
  score: number;
  feedback: string;
  corrected: string | null;
  expected: string;
}

const ROUND_SIZE = 5;

const TITLES: Record<DrillKind, string> = {
  fill_blank: "Fill in the blank",
  translation: "Translation",
};

export function WrittenDrill({
  context,
  kind,
  direction = "to-target",
}: {
  context: ActivityContext;
  kind: DrillKind;
  direction?: "to-target" | "to-native";
}) {
  const [items, setItems] = useState<(FillBlankExercise | TranslationExercise)[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealHint, setRevealHint] = useState(false);
  const [tally, setTally] = useState({ correct: 0, points: 0 });
  const [done, setDone] = useState(false);

  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = useCallback(async () => {
    setItems(null);
    setError(null);
    setIndex(0);
    setAnswer("");
    setGrade(null);
    setRevealHint(false);
    setTally({ correct: 0, points: 0 });
    setDone(false);
    startedAt.current = Date.now();

    try {
      const data = await postJson<{
        exercises: (FillBlankExercise | TranslationExercise)[];
      }>("/api/exercises", { ...context, kind, count: ROUND_SIZE, direction });
      setItems(data.exercises);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [context, kind, direction]);

  useEffect(() => {
    void generate();
  }, [generate]);

  useEffect(() => {
    if (!grade && items) inputRef.current?.focus();
  }, [index, grade, items]);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (!items || grade || checking) return;

    setChecking(true);
    setError(null);

    const item = items[index];
    const isFillBlank = kind === "fill_blank";
    const expected = isFillBlank
      ? (item as FillBlankExercise).answer
      : (item as TranslationExercise).answer;

    try {
      const data = await postJson<Grade>("/api/exercises/grade", {
        ...context,
        kind,
        answer,
        expected,
        alternatives: isFillBlank ? [] : (item as TranslationExercise).alternatives,
        source: isFillBlank ? undefined : (item as TranslationExercise).prompt,
      });

      setGrade(data);
      // A hinted answer still counts, but at half credit — otherwise the hint
      // is strictly better than thinking.
      const earned = data.correct ? (revealHint ? 5 : 10) : 0;
      setTally((prev) => ({
        correct: prev.correct + (data.correct ? 1 : 0),
        points: prev.points + earned,
      }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setChecking(false);
    }
  }

  function advance() {
    if (!items) return;

    if (index + 1 >= items.length) {
      setDone(true);
      void reportProgress(context, {
        activityType: kind,
        pointsEarned: tally.points,
        itemsTotal: items.length,
        itemsCorrect: tally.correct,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
      return;
    }

    setIndex((prev) => prev + 1);
    setAnswer("");
    setGrade(null);
    setRevealHint(false);
  }

  const title = TITLES[kind];

  if (error && !items) {
    return (
      <>
        <ActivityHeader title={title} />
        <ErrorBox message={error} />
        <button type="button" onClick={() => void generate()} className="crt-button mt-4">
          Retry
        </button>
      </>
    );
  }

  if (!items) {
    return (
      <>
        <ActivityHeader title={title} />
        <Loading label="Writing exercises" />
      </>
    );
  }

  if (done) {
    return (
      <>
        <ActivityHeader title={title} />
        <SessionSummary
          correct={tally.correct}
          total={items.length}
          points={tally.points}
          onRestart={() => void generate()}
        />
      </>
    );
  }

  const item = items[index];
  const fillBlank = kind === "fill_blank" ? (item as FillBlankExercise) : null;
  const translation = kind === "translation" ? (item as TranslationExercise) : null;

  return (
    <>
      <ActivityHeader
        title={title}
        subtitle={
          fillBlank
            ? "Type the word that belongs in the blank."
            : direction === "to-target"
              ? "Translate into the target language."
              : "Translate into English."
        }
      >
        <ProgressDots total={items.length} current={index} />
      </ActivityHeader>

      <Panel>
        <p className="text-lg text-[var(--crt-fg-bright)] leading-relaxed">
          {fillBlank ? fillBlank.sentence : translation?.prompt}
        </p>

        {fillBlank && revealHint && fillBlank.hint ? (
          <p className="mt-2 text-sm text-[var(--crt-accent)]">Hint: {fillBlank.hint}</p>
        ) : null}

        <form onSubmit={check} className="mt-5">
          <label className="crt-label" htmlFor="answer">
            Your answer
          </label>
          <input
            id="answer"
            ref={inputRef}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={Boolean(grade) || checking}
            autoComplete="off"
            spellCheck={false}
            className="crt-input"
          />

          {!grade ? (
            <div className="mt-4 flex gap-3">
              <button type="submit" className="crt-button crt-button-primary" disabled={checking}>
                {checking ? "Checking…" : "Check"}
              </button>
              {fillBlank?.hint && !revealHint ? (
                <button
                  type="button"
                  onClick={() => setRevealHint(true)}
                  className="crt-button"
                >
                  Hint (half credit)
                </button>
              ) : null}
            </div>
          ) : null}
        </form>

        {grade ? (
          <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
            <p
              className={`text-sm font-bold uppercase tracking-[0.14em] ${
                grade.correct ? "text-[var(--crt-fg-bright)]" : "text-[var(--crt-danger)]"
              }`}
            >
              {grade.correct ? "Correct" : "Not quite"}
            </p>

            {grade.feedback ? (
              <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{grade.feedback}</p>
            ) : null}

            {!grade.correct ? (
              <p className="mt-2 text-sm">
                <span className="text-[var(--crt-fg-dim)]">Expected: </span>
                <span className="text-[var(--crt-fg-bright)]">{grade.expected}</span>
              </p>
            ) : null}

            {grade.corrected ? (
              <p className="mt-1 text-sm">
                <span className="text-[var(--crt-fg-dim)]">Corrected: </span>
                <span className="text-[var(--crt-fg-bright)]">{grade.corrected}</span>
              </p>
            ) : null}

            {fillBlank?.translation ? (
              <p className="mt-2 text-sm text-[var(--crt-fg-dim)] italic">
                {fillBlank.translation}
              </p>
            ) : null}

            {translation?.note ? (
              <p className="mt-2 text-sm text-[var(--crt-fg-dim)]">{translation.note}</p>
            ) : null}

            <button
              type="button"
              onClick={advance}
              autoFocus
              className="crt-button crt-button-primary mt-4"
            >
              {index + 1 >= items.length ? "Finish" : "Next"}
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
