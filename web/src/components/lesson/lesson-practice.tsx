"use client";

/**
 * A lesson's practice run.
 *
 * The browser holds the prompts only; each answer is graded by
 * /api/lessons/answer, which reveals the accepted answers and the one-line
 * reason. When the last item is done the run is recorded once via
 * /api/lessons/complete, which decides whether the lesson counts as complete.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import type { PublicPracticeItem } from "@/lib/curriculum/types";
import { languageLabel } from "@/lib/languages";
import { ErrorBox } from "@/components/crt";
import { AnswerInput } from "@/components/answer-input";
import { ChoiceOptions } from "@/components/choice-options";
import { CUE_MS, playCue, primeSounds } from "@/lib/sounds";
import { autoSpeak, stopSpeaking } from "@/lib/speech";
import { RichInline } from "@/components/rich-text";
import { ProgressDots } from "@/components/activity-shell";

interface ItemGrade {
  verdict: "correct" | "close" | "incorrect";
  score: number;
  points: number;
  note: string | null;
  answers: string[];
  why: string;
}

interface Outcome {
  score: number;
  passed: boolean;
  bestScore: number;
  completed: boolean;
}

const PASS_MARK = 70;

function instruction(item: PublicPracticeItem, language: string): string {
  if (item.type === "choice") return "Choose";
  if (item.type === "fill") return "Fill in the blank";
  return item.direction === "to-english"
    ? "Translate into English"
    : `Translate into ${languageLabel(language)}`;
}

export function LessonPractice({
  lessonId,
  language,
  items,
  nextLessonHref,
}: {
  lessonId: string;
  language: string;
  items: PublicPracticeItem[];
  nextLessonHref: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<ItemGrade | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ correct: 0, points: 0 });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [finished, setFinished] = useState(false);

  const router = useRouter();
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const item = items[index];

  useEffect(() => {
    if (result) nextRef.current?.focus();
    else if (item?.type !== "choice") inputRef.current?.focus({ preventScroll: true });
  }, [index, result, item?.type]);

  // Speak target-language text as it appears: a prompt to translate into
  // English, and after answering, the corrected sentence — a fill-in-the-blank
  // read back whole, so the learner hears the answer in context.
  useEffect(() => {
    if (finished || !item) return;
    if (item.type === "translate" && item.direction === "to-english") {
      autoSpeak(item.prompt, language);
    }
  }, [item, finished, language]);

  useEffect(() => {
    if (!result || !item) return;
    const text =
      item.type === "fill"
        ? item.prompt.replace("___", result.answers[0] ?? "")
        : item.type === "translate" && item.direction === "to-target"
          ? result.answers[0]
          : undefined;
    if (!text) return;
    // After the answer's chime, not over it.
    const timer = window.setTimeout(() => autoSpeak(text, language), CUE_MS);
    return () => window.clearTimeout(timer);
  }, [result, item, language]);

  useEffect(() => stopSpeaking, []);

  function restart() {
    setIndex(0);
    setAnswer("");
    setChosen(null);
    setResult(null);
    setError(null);
    setTally({ correct: 0, points: 0 });
    setOutcome(null);
    setFinished(false);
    startedAt.current = Date.now();
  }

  async function submit(value: string) {
    if (result || checking) return;
    primeSounds();
    setChecking(true);
    setError(null);

    try {
      const graded = await postJson<ItemGrade>("/api/lessons/answer", {
        lessonId,
        index: item.index,
        answer: value,
      });
      setResult(graded);
      const right = graded.verdict !== "incorrect";
      playCue(right ? "right" : "wrong");
      setTally((prev) => ({
        correct: prev.correct + (right ? 1 : 0),
        points: prev.points + graded.points,
      }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function advance() {
    if (index + 1 < items.length) {
      setIndex((prev) => prev + 1);
      setAnswer("");
      setChosen(null);
      setResult(null);
      return;
    }

    setFinished(true);
    playCue("done");
    try {
      setOutcome(
        await postJson<Outcome>("/api/lessons/complete", {
          lessonId,
          itemsTotal: items.length,
          itemsCorrect: tally.correct,
          pointsEarned: tally.points,
          durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      );
      // Points, streak and the lesson's tick live in server-rendered parts of
      // the page (header, lesson list); refresh them in place.
      router.refresh();
    } catch (cause) {
      setError(`Your score could not be saved: ${(cause as Error).message}`);
    }
  }

  if (finished) {
    const score = Math.round((tally.correct / items.length) * 100);
    const passed = score >= PASS_MARK;

    return (
      <div>
        <p className="text-2xl text-[var(--crt-fg-bright)] crt-glow">
          {tally.correct}/{items.length} · {score}%
          <span className="ml-3 text-base text-[var(--crt-accent)]">+{tally.points}</span>
        </p>
        <p className="mt-2 text-sm">
          {passed
            ? "Lesson complete. Its words now count toward your practice."
            : `Score ${PASS_MARK}% or more to complete the lesson. Re-read the parts you missed and try again.`}
        </p>
        {outcome && outcome.bestScore > score ? (
          <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">Your best: {outcome.bestScore}%</p>
        ) : null}
        {error ? (
          <div className="mt-3">
            <ErrorBox message={error} />
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {passed && nextLessonHref ? (
            <Link href={nextLessonHref} className="crt-button crt-button-primary no-underline">
              Next lesson
            </Link>
          ) : null}
          <button type="button" onClick={restart} className="crt-button">
            Practise again
          </button>
          <Link href="/learn/lessons" className="crt-button no-underline">
            All lessons
          </Link>
        </div>
      </div>
    );
  }

  const verdictColor =
    result?.verdict === "correct"
      ? "text-[var(--crt-fg-bright)]"
      : result?.verdict === "close"
        ? "text-[var(--crt-accent)]"
        : "text-[var(--crt-danger)]";

  const typing = item.type === "translate" && item.direction === "to-english" ? "english" : "target";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]">
          {instruction(item, language)}
        </p>
        <ProgressDots total={items.length} current={index} />
      </div>

      <p className="mt-2 text-xl text-[var(--crt-fg-bright)] break-words">
        <RichInline text={item.type === "fill" ? item.prompt.replace("___", "_____") : item.prompt} />
        {item.hint ? (
          <span className="ml-2 text-sm text-[var(--crt-fg-dim)]">({item.hint})</span>
        ) : null}
      </p>
      {item.translation ? (
        <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">“{item.translation}”</p>
      ) : null}

      {item.type === "choice" ? (
        <ChoiceOptions
          options={item.options ?? []}
          chosen={chosen}
          correct={result?.answers ?? null}
          disabled={Boolean(result) || checking}
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
            id="lesson-answer"
            value={answer}
            onChange={setAnswer}
            inputRef={inputRef}
            language={language}
            typing={typing}
            disabled={Boolean(result) || checking}
          />
          {!result ? (
            <button type="submit" className="crt-button crt-button-primary mt-4" disabled={checking}>
              {checking ? "Checking…" : "Check"}
            </button>
          ) : null}
        </form>
      )}

      {result ? (
        <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
          <p className={`text-sm font-bold uppercase tracking-[0.14em] ${verdictColor}`}>
            {result.verdict === "correct" ? "Correct" : result.verdict === "close" ? "Close" : "Not quite"}
            {result.points > 0 ? (
              <span className="ml-2 text-[var(--crt-accent)]">+{result.points}</span>
            ) : null}
          </p>
          {result.note ? <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{result.note}</p> : null}
          {item.type !== "choice" ? (
            <p className="mt-2 text-sm">
              <span className="text-[var(--crt-fg-dim)]">Answer: </span>
              <span className="text-[var(--crt-fg-bright)]">{result.answers[0]}</span>
              {result.answers.length > 1 ? (
                <span className="text-[var(--crt-fg-dim)]">
                  {" "}
                  · also accepted: {result.answers.slice(1).join(" · ")}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            <RichInline text={result.why} />
          </p>
          <button
            ref={nextRef}
            type="button"
            onClick={() => void advance()}
            className="crt-button crt-button-primary mt-4"
          >
            {index + 1 >= items.length ? "Finish" : "Next"}
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
