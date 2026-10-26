"use client";

/**
 * One step on the guided path: a few minutes of cards, one at a time.
 *
 * The server plans the step (/api/steps) and grades each answer
 * (/api/steps/answer), which also moves the item along its stage ladder. A
 * missed card comes back once at the end. When the last card is done the
 * step is recorded (/api/steps/complete) and the learner chooses another step
 * or stops for the day.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { languageLabel } from "@/lib/languages";
import { CUE_MS, playCue, primeSounds } from "@/lib/sounds";
import { autoSpeak, stopSpeaking } from "@/lib/speech";
import type { PublicExercise, PublicStep, StepAnswerResult } from "@/lib/path/types";
import type { UnitProgress } from "@/lib/path/planner";
import { countLine } from "@/lib/path/count-line";
import { ErrorBox } from "@/components/crt";
import { Loading } from "@/components/activity-shell";
import { AnswerInput } from "@/components/answer-input";
import { ChoiceOptions } from "@/components/choice-options";
import { RichInline } from "@/components/rich-text";
import { SpeakButton } from "@/components/speak-button";
import { LessonSectionBody } from "@/components/lesson/lesson-section";
import { DialogueCard } from "./dialogue-card";
import { TileBuilder } from "./tile-builder";

type Card = PublicExercise & { retry?: boolean };

const EMPTY_TALLY = { total: 0, correct: 0, points: 0, otherForm: 0, misspelt: 0, accentOtherForm: 0, accentOtherWord: 0, accentPlain: 0 };

interface Finish {
  unit: UnitProgress;
  streak: number;
  /** For a level-up challenge: whether it completed the unit. */
  passed: boolean | null;
  /** The next unit not yet complete, to try its challenge. */
  next: { id: string; code: string; title: string } | null;
  /** Levels this step finished, e.g. ["a1"]. */
  finishedLevels: string[];
}

const LABEL = "text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]";

function instruction(card: Card, language: string): string {
  const name = languageLabel(language);
  switch (card.mode) {
    case "recognize":
      return card.isNew && !card.retry ? "New — what does it mean?" : "What does it mean?";
    case "recall":
      return `Which is it in ${name}?`;
    case "type":
      return `Type it in ${name}`;
    case "build":
      return card.kind === "grammar" ? `Put the words in order` : `Build it in ${name}`;
    case "cloze":
      return "Fill in the missing word";
    case "reply":
      return `Reply in ${name}`;
    case "question":
      if (card.question.type === "choice") return "Choose";
      if (card.question.type === "fill") return "Fill in the blank";
      return card.question.direction === "to-english" ? "Translate into English" : `Translate into ${name}`;
    default:
      return "";
  }
}

/** Cards that teach or remind, with nothing to answer. */
function isReading(card: Card | undefined): boolean {
  return card?.mode === "learn" || card?.mode === "meet" || card?.mode === "remind";
}

/** Cards answered by typing. */
function isTyped(card: Card | undefined): boolean {
  return (
    card?.mode === "type" ||
    card?.mode === "cloze" ||
    card?.mode === "reply" ||
    (card?.mode === "question" && card.question.type !== "choice")
  );
}

/** The sentence a cloze card makes once its blank is filled. */
function filled(card: Extract<Card, { mode: "cloze" }>, word: string): string {
  return `${card.before}${word}${card.after}`;
}

/** Shuffle a retried multiple-choice card so the answer is not where it was. */
function reshuffle(card: Card): Card {
  const shuffle = (options: string[]) => [...options].sort(() => Math.random() - 0.5);
  if (card.mode === "recognize" || card.mode === "recall") {
    return { ...card, options: shuffle(card.options) };
  }
  if (card.mode === "build") return { ...card, tiles: shuffle(card.tiles) };
  if (card.mode === "question" && card.question.options) {
    return { ...card, question: { ...card.question, options: shuffle(card.question.options) } };
  }
  return card;
}

export function StepRunner({ language, challenge }: { language: string; challenge?: string }) {
  const [step, setStep] = useState<PublicStep | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<StepAnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState(EMPTY_TALLY);
  /** The accent tip shows once per learner, on the first answer an accent changed: the server says when (#114). */
  const [accentTip, setAccentTip] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [finishing, setFinishing] = useState(false);

  const router = useRouter();
  const startedAt = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setStep(null);
    setFinish(null);
    setError(null);
    setIndex(0);
    setAnswer("");
    setChosen(null);
    setResult(null);
    setTally(EMPTY_TALLY);
    try {
      const next = await postJson<PublicStep>("/api/steps", challenge ? { challenge } : {});
      setStep(next);
      setQueue(next.exercises);
      startedAt.current = Date.now();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [challenge]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => stopSpeaking, []);

  const card = queue[index];

  // Focus: the Next button after an answer, otherwise the text box.
  useEffect(() => {
    if (result || isReading(card)) nextRef.current?.focus();
    else if (isTyped(card)) inputRef.current?.focus({ preventScroll: true });
  }, [card, result]);

  // Speak target-language text as it appears…
  useEffect(() => {
    if (!card || finish) return;
    if (card.mode === "recognize") autoSpeak(card.prompt, language);
    else if (card.mode === "meet") autoSpeak(card.entries[0]?.target, language);
    else if (card.mode === "remind" && card.kind !== "grammar") autoSpeak(card.title, language);
    else if (card.mode === "reply") autoSpeak(card.context?.target, language);
    else if (card.mode === "question" && card.question.direction === "to-english") {
      autoSpeak(card.question.prompt, language);
    }
  }, [card, finish, language]);

  // …and the right answer once it is revealed, after the answer's chime.
  useEffect(() => {
    if (!card || !result) return;
    let text: string | undefined;
    if (card.mode === "recall" || card.mode === "type" || card.mode === "build" || card.mode === "reply") {
      text = result.answers[0];
    } else if (card.mode === "cloze") text = filled(card, result.answers[0] ?? "");
    else if (card.mode === "question") {
      if (card.question.type === "fill") text = card.question.prompt.replace("___", result.answers[0] ?? "");
      else if (card.question.direction === "to-target") text = result.answers[0];
    }
    if (!text) return;
    const timer = window.setTimeout(() => autoSpeak(text, language), CUE_MS);
    return () => window.clearTimeout(timer);
  }, [card, result, language]);

  /** Accuracy counts first tries; a retry still earns its points. */
  function count(graded: StepAnswerResult, retry: boolean) {
    const right = graded.verdict !== "incorrect";
    setTally((prev) => ({
      total: prev.total + (retry ? 0 : 1),
      correct: prev.correct + (right && !retry ? 1 : 0),
      points: prev.points + graded.points,
      // Near misses rejected for a wrong ending (#70), for the owner's weekly look at their effect.
      otherForm: prev.otherForm + (graded.endingMiss === "otherForm" ? 1 : 0),
      misspelt: prev.misspelt + (graded.endingMiss === "misspelt" ? 1 : 0),
      // Accents that change the word (#114), and plain accent slips.
      accentOtherForm: prev.accentOtherForm + (graded.accentMiss === "otherForm" ? 1 : 0),
      accentOtherWord: prev.accentOtherWord + (graded.accentMiss === "otherWord" ? 1 : 0),
      accentPlain: prev.accentPlain + (graded.accentMiss === "plain" ? 1 : 0),
    }));
  }

  async function submit(value: string) {
    if (!card || result || checking) return;
    if (isReading(card) || card.mode === "dialogue") return;
    primeSounds();
    setChecking(true);
    setError(null);

    try {
      const graded = await postJson<StepAnswerResult>("/api/steps/answer", {
        itemKey: card.itemKey,
        mode: card.mode,
        question: card.mode === "question" ? card.question.index : undefined,
        sentence: card.mode === "build" || card.mode === "cloze" ? card.sentence : undefined,
        dialogue: card.mode === "reply" ? card.dialogue : undefined,
        line: card.mode === "reply" ? card.line : undefined,
        challenge: step?.challenge || undefined,
        answer: value,
      });
      setResult(graded);
      setAccentTip(Boolean(graded.accentTip));
      const right = graded.verdict !== "incorrect";
      playCue(right ? "right" : "wrong");
      count(graded, Boolean(card.retry));
      // A challenge has no second tries: it shows what the learner knows.
      if (!right && !card.retry && !step?.challenge) {
        setQueue((prev) => [...prev, reshuffle({ ...card, id: `${card.id}-again`, retry: true })]);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function advance() {
    if (index + 1 < queue.length) {
      setIndex((prev) => prev + 1);
      setAnswer("");
      setChosen(null);
      setResult(null);
      return;
    }
    if (!step || finishing) return;

    setFinishing(true);
    primeSounds();
    try {
      setFinish(
        await postJson<Finish>("/api/steps/complete", {
          unitId: step.unit.id,
          itemsTotal: tally.total,
          itemsCorrect: tally.correct,
          pointsEarned: tally.points,
          durationSec: Math.round((Date.now() - startedAt.current) / 1000),
          challenge: step.challenge || undefined,
          endingMisses: { otherForm: tally.otherForm, misspelt: tally.misspelt },
          accentMisses: { otherForm: tally.accentOtherForm, otherWord: tally.accentOtherWord, plain: tally.accentPlain },
        }),
      );
      playCue("done");
      // Points and streak live in the server-rendered header.
      router.refresh();
    } catch (cause) {
      setError(`Your step could not be saved: ${(cause as Error).message}`);
    } finally {
      setFinishing(false);
    }
  }

  if (error && !step) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error} />
        <Link href="/learn" className="crt-button no-underline">
          Back
        </Link>
      </div>
    );
  }

  if (!step) return <Loading label="Getting your next step ready" />;

  if (finish) {
    return (
      <StepDone
        finish={finish}
        tally={tally}
        challenge={step.challenge}
        language={language}
        onNext={() => void load()}
      />
    );
  }

  if (!card) {
    return (
      <div className="space-y-4">
        <p>Nothing to practise right now — you are all caught up.</p>
        <Link href="/learn" className="crt-button no-underline">
          Back
        </Link>
      </div>
    );
  }

  const progress = Math.round((index / queue.length) * 100);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/learn"
          aria-label="Stop and go back"
          title="Stop"
          className="text-lg leading-none no-underline text-[var(--crt-fg-dim)] hover:text-[var(--crt-danger)]"
        >
          ×
        </Link>
        <div
          className="h-2 flex-1 border border-[var(--crt-rule)]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-[var(--crt-accent)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className={LABEL}>
          {step.challenge ? "Challenge · " : ""}
          {step.unit.code} · {step.unit.title}
        </span>
      </div>

      {card.mode === "dialogue" ? (
        <DialogueCard
          key={card.id}
          card={card}
          language={language}
          busy={finishing}
          onTurn={(graded) => count(graded, false)}
          onFinish={() => void advance()}
        />
      ) : (
        <CardBody
          key={card.id}
          card={card}
          language={language}
          answer={answer}
          setAnswer={setAnswer}
          chosen={chosen}
          result={result}
          checking={checking}
          inputRef={inputRef}
          onPick={(option) => {
            setChosen(option);
            void submit(option);
          }}
          onSubmit={() => void submit(answer)}
        />
      )}

      {isReading(card) ? (
        <button
          ref={nextRef}
          type="button"
          onClick={() => void advance()}
          className="crt-button crt-button-primary mt-6"
        >
          {card.mode === "learn" ? "Got it" : "Continue"}
        </button>
      ) : null}

      {result ? (
        <Feedback
          card={card}
          result={result}
          accentTip={accentTip}
          nextRef={nextRef}
          last={index + 1 >= queue.length}
          busy={finishing}
          onNext={() => void advance()}
        />
      ) : null}

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
    </div>
  );
}

function CardBody({
  card,
  language,
  answer,
  setAnswer,
  chosen,
  result,
  checking,
  inputRef,
  onPick,
  onSubmit,
}: {
  card: Card;
  language: string;
  answer: string;
  setAnswer: (value: string) => void;
  chosen: string | null;
  result: StepAnswerResult | null;
  checking: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (option: string) => void;
  onSubmit: () => void;
}) {
  const answered = Boolean(result) || checking;

  if (card.mode === "learn") {
    return (
      <div>
        <p className={LABEL}>
          Learn · {card.lessonTitle} · {card.sectionNumber} of {card.sectionCount}
        </p>
        <h2 className="mt-2 text-xl text-[var(--crt-fg-bright)] crt-glow">
          <RichInline text={card.section.heading} />
        </h2>
        <div className="mt-4">
          <LessonSectionBody section={card.section} language={language} />
        </div>
      </div>
    );
  }

  if (card.mode === "meet") {
    return (
      <div>
        <p className={LABEL}>{card.kind === "phrase" ? "New phrases" : "New words"}</p>
        <ul className="mt-4 space-y-4">
          {card.entries.map((entry) => (
            <li key={entry.key}>
              <div className="flex items-baseline gap-2">
                <SpeakButton text={entry.target} language={language} />
                <span className="text-xl text-[var(--crt-fg-bright)] crt-glow">{entry.target}</span>
                <span className="text-[var(--crt-fg-dim)]">— {entry.english}</span>
              </div>
              {entry.literally ? (
                <p className="ml-7 text-xs text-[var(--crt-fg-dim)]">Literally: {entry.literally}</p>
              ) : null}
              {entry.note ? (
                <p className="ml-7 text-sm">
                  <RichInline text={entry.note} />
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (card.mode === "remind") {
    return (
      <div>
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-accent)]">
          Remember this one
        </p>
        <p className="mt-2 flex items-baseline gap-2 text-2xl text-[var(--crt-fg-bright)] crt-glow">
          {card.kind === "grammar" ? null : <SpeakButton text={card.title} language={language} />}
          <span>
            <RichInline text={card.title} />
          </span>
        </p>
        {card.text ? (
          <p className="mt-2 text-base">
            <RichInline text={card.text} />
          </p>
        ) : null}
        {card.example ? (
          <p className="mt-4 flex items-baseline gap-2 text-sm">
            <SpeakButton text={card.example.target} language={language} />
            <span>
              <span className="text-[var(--crt-fg-bright)]">{card.example.target}</span>
              {card.example.english ? (
                <span className="text-[var(--crt-fg-dim)]"> — {card.example.english}</span>
              ) : null}
            </span>
          </p>
        ) : null}
        <p className="mt-4 text-xs text-[var(--crt-fg-dim)]">It comes up again in a moment.</p>
      </div>
    );
  }

  if (card.mode === "dialogue") return null;

  const typingForm = (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <AnswerInput
        id="step-answer"
        value={answer}
        onChange={setAnswer}
        inputRef={inputRef}
        language={language}
        typing={card.mode === "question" && card.question.direction === "to-english" ? "english" : "target"}
        disabled={answered}
      />
      {!result ? (
        <button type="submit" className="crt-button crt-button-primary mt-4" disabled={checking}>
          {checking ? "Checking…" : "Check"}
        </button>
      ) : null}
    </form>
  );

  if (card.mode === "build") {
    return (
      <div>
        <p className={LABEL}>
          {instruction(card, language)}
          {card.retry ? " · one more try" : ""}
        </p>
        <p className="mt-2 text-2xl text-[var(--crt-fg-bright)] break-words">{card.prompt}</p>
        <TileBuilder tiles={card.tiles} disabled={answered} onChange={setAnswer} />
        {!result ? (
          <button
            type="button"
            className="crt-button crt-button-primary mt-5"
            disabled={checking || !answer}
            onClick={onSubmit}
          >
            {checking ? "Checking…" : "Check"}
          </button>
        ) : null}
      </div>
    );
  }

  if (card.mode === "cloze") {
    return (
      <div>
        <p className={LABEL}>
          {instruction(card, language)}
          {card.retry ? " · one more try" : ""}
        </p>
        <p className="mt-2 text-2xl text-[var(--crt-fg-bright)] break-words">
          {card.before}
          <span className="mx-1 inline-block min-w-[3em] border-b-2 border-[var(--crt-accent)] text-[var(--crt-accent)]">
            {result ? result.answers[0] : "\u00a0"}
          </span>
          {card.after}
        </p>
        {card.translation ? (
          <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">“{card.translation}”</p>
        ) : card.hint ? (
          <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">The missing word means “{card.hint}”.</p>
        ) : null}
        {typingForm}
      </div>
    );
  }

  if (card.mode === "reply") {
    return (
      <div>
        {card.context ? (
          <div className="mb-5">
            <p className={LABEL}>{card.with}</p>
            <p className="mt-1 flex items-baseline gap-2 text-xl text-[var(--crt-fg-bright)]">
              <SpeakButton text={card.context.target} language={language} />
              <span>{card.context.target}</span>
            </p>
            <p className="text-sm text-[var(--crt-fg-dim)]">“{card.context.english}”</p>
          </div>
        ) : null}
        <p className={LABEL}>
          {instruction(card, language)}
          {card.retry ? " · one more try" : ""}
        </p>
        <p className="mt-2 text-xl text-[var(--crt-fg-bright)]">{card.instruction}</p>
        {typingForm}
      </div>
    );
  }

  const prompt =
    card.mode === "question"
      ? card.question.type === "fill"
        ? card.question.prompt.replace("___", "_____")
        : card.question.prompt
      : card.prompt;
  const speaksPrompt =
    card.mode === "recognize" || (card.mode === "question" && card.question.direction === "to-english");
  const options =
    card.mode === "recognize" || card.mode === "recall"
      ? card.options
      : card.mode === "question"
        ? card.question.options
        : null;

  return (
    <div>
      <p className={LABEL}>
        {instruction(card, language)}
        {card.retry ? " · one more try" : ""}
      </p>
      <p className="mt-2 flex items-baseline gap-2 text-2xl text-[var(--crt-fg-bright)] break-words">
        {speaksPrompt ? <SpeakButton text={prompt} language={language} /> : null}
        <span>
          <RichInline text={prompt} />
          {card.mode === "question" && card.question.hint ? (
            <span className="ml-2 text-sm text-[var(--crt-fg-dim)]">({card.question.hint})</span>
          ) : null}
        </span>
      </p>
      {card.mode === "question" && card.question.translation ? (
        <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">“{card.question.translation}”</p>
      ) : null}

      {options ? (
        <ChoiceOptions
          options={options}
          chosen={chosen}
          correct={result?.answers ?? null}
          disabled={answered}
          onPick={onPick}
        />
      ) : (
        typingForm
      )}
    </div>
  );
}

function Feedback({
  card,
  result,
  accentTip,
  nextRef,
  last,
  busy,
  onNext,
}: {
  card: Card;
  result: StepAnswerResult;
  accentTip: boolean;
  nextRef: React.RefObject<HTMLButtonElement | null>;
  last: boolean;
  busy: boolean;
  onNext: () => void;
}) {
  const color =
    result.verdict === "correct"
      ? "text-[var(--crt-fg-bright)]"
      : result.verdict === "close"
        ? "text-[var(--crt-accent)]"
        : "text-[var(--crt-danger)]";
  const clicked =
    card.mode === "recognize" ||
    card.mode === "recall" ||
    (card.mode === "question" && card.question.type === "choice");

  return (
    <div className="mt-5 border-t border-[var(--crt-rule)] pt-4">
      <p className={`text-sm font-bold uppercase tracking-[0.14em] ${color}`}>
        {result.verdict === "correct" ? "Correct" : result.verdict === "close" ? "Close" : "Not quite"}
        {result.points > 0 ? <span className="ml-2 text-[var(--crt-accent)]">+{result.points}</span> : null}
        {result.promoted ? (
          <span className="ml-3 normal-case tracking-normal text-[var(--crt-accent)]">★ getting stronger</span>
        ) : null}
      </p>
      {result.note ? <p className="mt-1 text-sm text-[var(--crt-fg-dim)]">{result.note}</p> : null}
      {accentTip ? (
        <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">
          A missing accent can make another word (<em>parle</em> for <em>parlé</em>). Use the accent bar under the box.
        </p>
      ) : null}
      {!clicked ? (
        <p className="mt-2 text-sm">
          <span className="text-[var(--crt-fg-dim)]">Answer: </span>
          <span className="text-[var(--crt-fg-bright)]">{result.answers[0]}</span>
          {result.answers.length > 1 ? (
            <span className="text-[var(--crt-fg-dim)]"> · also accepted: {result.answers.slice(1).join(" · ")}</span>
          ) : null}
        </p>
      ) : null}
      {result.why ? (
        <p className="mt-2 text-sm">
          <RichInline text={result.why} />
        </p>
      ) : null}
      {result.verdict === "incorrect" && !card.retry ? (
        <p className="mt-2 text-xs text-[var(--crt-fg-dim)]">This one will come back at the end.</p>
      ) : null}
      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        disabled={busy}
        className="crt-button crt-button-primary mt-4"
      >
        {last ? (busy ? "Saving…" : "Finish") : "Next"}
      </button>
    </div>
  );
}

function StepDone({
  finish,
  tally,
  challenge,
  language,
  onNext,
}: {
  finish: Finish;
  tally: { total: number; correct: number; points: number };
  challenge: boolean;
  language: string;
  onNext: () => void;
}) {
  const { unit, streak, passed, next, finishedLevels } = finish;
  const percent = unit.percent;
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <p className={LABEL}>{challenge ? `${unit.code} challenge` : "Step done"}</p>
        <p className="mt-2 text-3xl text-[var(--crt-fg-bright)] crt-glow">
          +{tally.points}
          <span className="ml-3 text-base text-[var(--crt-fg-dim)]">
            {tally.correct}/{tally.total} right{challenge ? "" : " first time"}
          </span>
        </p>
        <p className="mt-1 text-sm text-[var(--crt-accent)]">
          {streak} day{streak === 1 ? "" : "s"} in a row
        </p>
      </div>

      {challenge && !passed ? (
        <div className="border-l-2 border-[var(--crt-accent)] pl-3 text-sm">
          <p className="text-[var(--crt-fg-bright)]">Not quite yet — {unit.code} needs 8 in 10.</p>
          <p className="mt-1 text-[var(--crt-fg-dim)]">
            Everything you got right counts as learned. Try again now, or keep going with steps and come back.
          </p>
        </div>
      ) : null}

      <div>
        <p className="flex flex-wrap justify-between gap-x-3 text-sm">
          <span>
            <span className="text-[var(--crt-fg-bright)]">{unit.code}</span> · {unit.title}
          </span>
          <span className="text-[var(--crt-fg-dim)]">{percent}%</span>
        </p>
        <p className="mt-1 text-xs text-[var(--crt-fg-dim)]">
          {countLine(
            { done: unit.learned, onTheWay: unit.onTheWay, notMet: unit.notMet },
            "",
            "",
            "learned",
            "not met yet",
            "nothing new",
          )}
        </p>
        <div className="mt-2 h-3 border border-[var(--crt-rule)]">
          <div className="h-full bg-[var(--crt-accent)]" style={{ width: `${percent}%` }} />
        </div>
        {unit.complete ? (
          <p className="mt-3 text-lg text-[var(--crt-accent)] crt-glow">★ {unit.code} complete!</p>
        ) : null}
      </div>

      {finishedLevels.map((level) => (
        <div key={level} className="border-2 border-[var(--crt-accent)] p-4">
          <p className="text-xl text-[var(--crt-fg-bright)] crt-glow">
            ★ You finished {languageLabel(language)} {level.toUpperCase()}!
          </p>
          <p className="mt-2 text-sm">
            <Link href={`/learn/level/certificate?level=${level}`}>See your certificate &rarr;</Link>
          </p>
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        {challenge && !passed ? (
          <button type="button" onClick={onNext} className="crt-button crt-button-primary">
            Try again
          </button>
        ) : challenge && next ? (
          <button
            type="button"
            onClick={() => router.push(`/learn/step?challenge=${next.id}`)}
            className="crt-button crt-button-primary"
          >
            Try the {next.code} challenge
          </button>
        ) : null}
        {challenge ? (
          <Link href="/learn/step" className={`crt-button no-underline ${passed && !next ? "crt-button-primary" : ""}`}>
            Back to steps
          </Link>
        ) : (
          <button type="button" onClick={onNext} className="crt-button crt-button-primary">
            Next step
          </button>
        )}
        <Link href="/learn" className="crt-button no-underline">
          Done for today
        </Link>
      </div>
    </div>
  );
}
