"use client";

/**
 * Reading comprehension.
 *
 * Passage and questions come from a single generation call, so the questions
 * are about the passage the learner is actually reading. The CLI regenerated a
 * fresh passage per question, which is why its questions referenced text that
 * was never displayed (issue #8).
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

interface Question {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface Passage {
  title: string;
  passage: string;
  translation: string;
  questions: Question[];
}

const QUESTION_COUNT = 4;

export function Reading({ context }: { context: ActivityContext }) {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, points: 0 });
  const [done, setDone] = useState(false);

  const startedAt = useRef(Date.now());

  const generate = useCallback(
    async (requestedTopic?: string) => {
      setPassage(null);
      setError(null);
      setIndex(0);
      setSelected(null);
      setRevealed(false);
      setShowTranslation(false);
      setTally({ correct: 0, points: 0 });
      setDone(false);
      startedAt.current = Date.now();

      try {
        const data = await postJson<{ passage: Passage }>("/api/exercises", {
          ...context,
          kind: "reading",
          count: QUESTION_COUNT,
          topic: requestedTopic?.trim() || undefined,
        });
        setPassage(data.passage);
      } catch (cause) {
        setError((cause as Error).message);
      }
    },
    [context],
  );

  useEffect(() => {
    void generate();
  }, [generate]);

  function choose(option: number) {
    if (revealed || !passage) return;

    setSelected(option);
    setRevealed(true);

    const isCorrect = option === passage.questions[index].answerIndex;
    setTally((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      points: prev.points + (isCorrect ? 10 : 0),
    }));
  }

  function advance() {
    if (!passage) return;

    if (index + 1 >= passage.questions.length) {
      setDone(true);
      void reportProgress(context, {
        activityType: "reading",
        pointsEarned: tally.points,
        itemsTotal: passage.questions.length,
        itemsCorrect: tally.correct,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
      return;
    }

    setIndex((prev) => prev + 1);
    setSelected(null);
    setRevealed(false);
  }

  if (error && !passage) {
    return (
      <>
        <ActivityHeader title="Reading" />
        <ErrorBox message={error} />
        <button type="button" onClick={() => void generate()} className="crt-button mt-4">
          Retry
        </button>
      </>
    );
  }

  if (!passage) {
    return (
      <>
        <ActivityHeader title="Reading" />
        <Loading label="Writing a passage" />
      </>
    );
  }

  if (done) {
    return (
      <>
        <ActivityHeader title="Reading" />
        <SessionSummary
          correct={tally.correct}
          total={passage.questions.length}
          points={tally.points}
          onRestart={() => void generate(topic)}
        />
      </>
    );
  }

  const question = passage.questions[index];

  return (
    <>
      <ActivityHeader title="Reading" subtitle={passage.title}>
        <ProgressDots total={passage.questions.length} current={index} />
      </ActivityHeader>

      <Panel title="Passage">
        <p className="whitespace-pre-wrap leading-relaxed text-[var(--crt-fg-bright)]">
          {passage.passage}
        </p>

        {passage.translation ? (
          <>
            <button
              type="button"
              onClick={() => setShowTranslation((prev) => !prev)}
              className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)] hover:text-[var(--crt-accent)]"
            >
              {showTranslation ? "Hide" : "Show"} translation
            </button>
            {showTranslation ? (
              <p className="mt-2 whitespace-pre-wrap text-sm italic text-[var(--crt-fg-dim)]">
                {passage.translation}
              </p>
            ) : null}
          </>
        ) : null}
      </Panel>

      <Panel title={`Question ${index + 1}`} className="mt-8">
        <p className="text-[var(--crt-fg-bright)]">{question.question}</p>

        <ul className="mt-4 space-y-2">
          {question.options.map((option, i) => {
            const isAnswer = i === question.answerIndex;
            const isChosen = i === selected;

            const tone = !revealed
              ? "border-[var(--crt-rule)] hover:border-[var(--crt-fg-dim)]"
              : isAnswer
                ? "border-[var(--crt-fg-bright)] text-[var(--crt-fg-bright)]"
                : isChosen
                  ? "border-[var(--crt-danger)] text-[var(--crt-danger)]"
                  : "border-[var(--crt-rule)] opacity-60";

            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  disabled={revealed}
                  className={`w-full border p-3 text-left text-sm transition-colors ${tone}`}
                >
                  <span className="mr-2 text-[var(--crt-fg-dim)]">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        {revealed ? (
          <div className="mt-4 border-t border-[var(--crt-rule)] pt-4">
            <p
              className={`text-sm font-bold uppercase tracking-[0.14em] ${
                selected === question.answerIndex
                  ? "text-[var(--crt-fg-bright)]"
                  : "text-[var(--crt-danger)]"
              }`}
            >
              {selected === question.answerIndex ? "Correct" : "Not quite"}
            </p>
            {question.explanation ? (
              <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{question.explanation}</p>
            ) : null}

            <button
              type="button"
              onClick={advance}
              autoFocus
              className="crt-button crt-button-primary mt-4"
            >
              {index + 1 >= passage.questions.length ? "Finish" : "Next"}
            </button>
          </div>
        ) : null}
      </Panel>

      <Panel title="New passage" className="mt-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow min-w-[12rem]">
            <label className="crt-label" htmlFor="topic">
              Topic (optional)
            </label>
            <input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="markets, trains, family"
              className="crt-input"
            />
          </div>
          <button type="button" onClick={() => void generate(topic)} className="crt-button">
            Generate
          </button>
        </div>
      </Panel>

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
    </>
  );
}
