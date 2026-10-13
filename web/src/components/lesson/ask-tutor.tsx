"use client";

/**
 * "Ask about this lesson": free-text questions answered by the model, with the
 * lesson as context. Failures show the real reason, never a made-up answer.
 */

import { useState } from "react";
import { postJson } from "@/lib/client-api";
import { ErrorBox } from "@/components/crt";
import { RichText } from "@/components/rich-text";

interface Exchange {
  question: string;
  answer: string;
}

export function AskTutor({ lessonId, example }: { lessonId: string; example: string }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Exchange[]>([]);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;

    setAsking(true);
    setError(null);
    try {
      const { answer } = await postJson<{ answer: string }>("/api/lessons/ask", {
        lessonId,
        question: text,
      });
      setHistory((prev) => [...prev, { question: text, answer }]);
      setQuestion("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      {history.length > 0 ? (
        <ol className="mb-5 space-y-4">
          {history.map((exchange, index) => (
            <li key={index}>
              <p className="text-sm text-[var(--crt-fg-dim)]">
                <span aria-hidden="true">] </span>
                {exchange.question}
              </p>
              <RichText text={exchange.answer} className="mt-2 text-sm" />
            </li>
          ))}
        </ol>
      ) : null}

      <form onSubmit={ask}>
        <label className="crt-label" htmlFor="tutor-question">
          Your question
        </label>
        <textarea
          id="tutor-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          rows={2}
          placeholder={example}
          className="crt-input resize-y"
        />
        <button type="submit" className="crt-button mt-3" disabled={asking || !question.trim()}>
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}
    </div>
  );
}
