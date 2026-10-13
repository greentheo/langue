"use client";

/**
 * A grid of clickable answers, shared by flashcards and lesson practice.
 *
 * Big enough to tap comfortably — younger learners use this mode most. After
 * an answer, the right option lights up and a wrong pick turns red; the others
 * fade so the eye goes straight to the correction.
 */

import { RichInline } from "@/components/rich-text";

export function ChoiceOptions({
  options,
  chosen,
  correct,
  disabled,
  onPick,
}: {
  options: string[];
  /** The option the learner clicked, once they have. */
  chosen: string | null;
  /** The accepted answers, known only after grading. */
  correct: string[] | null;
  disabled: boolean;
  onPick: (option: string) => void;
}) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isAnswer = correct?.includes(option) ?? false;
        const isWrongPick = Boolean(correct) && chosen === option && !isAnswer;
        const tone = !correct
          ? ""
          : isAnswer
            ? "border-[var(--crt-fg-bright)] text-[var(--crt-fg-bright)] disabled:opacity-100"
            : isWrongPick
              ? "border-[var(--crt-danger)] text-[var(--crt-danger)] disabled:opacity-100"
              : "";

        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option)}
            className={`crt-button justify-start py-3 text-left text-base normal-case tracking-normal ${tone}`}
          >
            {isAnswer ? <span aria-label="correct answer">✓ </span> : null}
            <RichInline text={option} />
          </button>
        );
      })}
    </div>
  );
}
