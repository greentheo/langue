"use client";

/**
 * Conversation practice.
 *
 * Carries over the beginner support added to the CLI in de7a248: a bilingual
 * toggle that asks the tutor to gloss each reply in the learner's native
 * language, and correction modes. Replies stream token by token — waiting for a
 * complete paragraph makes a conversation feel like a form submission.
 */

import { useEffect, useRef, useState } from "react";
import { reportProgress, type ActivityContext } from "@/lib/client-api";
import { ErrorBox, Panel } from "@/components/crt";
import { ActivityHeader } from "@/components/activity-shell";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

type CorrectionMode = "none" | "gentle" | "detailed";

const OPENERS: Record<string, string> = {
  italian: "Ciao! Di cosa parliamo oggi?",
  spanish: "¡Hola! ¿De qué hablamos hoy?",
  portuguese: "Olá! Sobre o que vamos falar hoje?",
  french: "Bonjour ! De quoi parlons-nous aujourd'hui ?",
};

export function Conversation({
  context,
  beginner,
}: {
  context: ActivityContext;
  beginner: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: OPENERS[context.language] ?? "Hello! What shall we talk about?" },
  ]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bilingual, setBilingual] = useState(beginner);
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>("gentle");
  const [topic, setTopic] = useState("");

  const transcriptRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(Date.now());
  const reported = useRef(false);

  // Keep the newest turn in view as it streams in.
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  // Record the session when the learner leaves the page.
  useEffect(() => {
    return () => {
      const userTurns = turns.filter((turn) => turn.role === "user").length;
      if (reported.current || userTurns === 0) return;
      reported.current = true;

      void reportProgress(context, {
        activityType: "conversation",
        // Conversation has no right answer to score, so points reward
        // participation: one per exchange, capped so a marathon session cannot
        // outweigh graded work.
        pointsEarned: Math.min(userTurns * 5, 100),
        itemsTotal: userTurns,
        itemsCorrect: userTurns,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      });
    };
  }, [context, turns]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || streaming) return;

    const next: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(next);
    setDraft("");
    setStreaming(true);
    setError(null);

    // Placeholder the stream fills in.
    setTurns([...next, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...context,
          messages: next,
          topic: topic.trim() || undefined,
          bilingual,
          correctionMode,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = await response
          .json()
          .then((data: { error?: string }) => data.error)
          .catch(() => null);
        throw new Error(detail ?? `The tutor is unavailable (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";

      // SSE frames are separated by a blank line and may split across chunks.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          const event = JSON.parse(line.slice(5).trim()) as
            | { type: "delta"; text: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (event.type === "delta") {
            reply += event.text;
            setTurns([...next, { role: "assistant", content: reply }]);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!reply.trim()) {
        throw new Error("The tutor returned an empty reply.");
      }
    } catch (cause) {
      setError((cause as Error).message);
      // Drop the empty placeholder so the transcript never shows a blank turn.
      setTurns(next);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <ActivityHeader
        title="Conversation"
        subtitle="Type in the target language. Shift+Enter for a new line."
      />

      <Panel title="Setup" className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grow min-w-[12rem]">
            <label className="crt-label" htmlFor="topic">
              Topic (optional)
            </label>
            <input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="ordering at a café"
              className="crt-input"
            />
          </div>

          <div>
            <label className="crt-label" htmlFor="corrections">
              Corrections
            </label>
            <select
              id="corrections"
              value={correctionMode}
              onChange={(event) => setCorrectionMode(event.target.value as CorrectionMode)}
              className="crt-input"
            >
              <option value="none">None</option>
              <option value="gentle">Gentle</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <label className="flex items-center gap-2 pb-2 text-xs uppercase tracking-[0.14em] text-[var(--crt-fg-dim)]">
            <input
              type="checkbox"
              checked={bilingual}
              onChange={(event) => setBilingual(event.target.checked)}
            />
            Show translations
          </label>
        </div>
      </Panel>

      <Panel>
        <div
          ref={transcriptRef}
          className="max-h-[26rem] overflow-y-auto space-y-4 pr-1"
          aria-live="polite"
        >
          {turns.map((turn, i) => (
            <div key={i}>
              <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--crt-fg-dim)]">
                {turn.role === "user" ? "You" : "Tutor"}
              </div>
              <div
                className={`whitespace-pre-wrap text-sm ${
                  turn.role === "user"
                    ? "text-[var(--crt-fg)]"
                    : "text-[var(--crt-fg-bright)]"
                }`}
              >
                {turn.content}
                {streaming && i === turns.length - 1 && turn.role === "assistant" ? (
                  <span className="crt-cursor" aria-hidden="true" />
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={send} className="mt-5 border-t border-[var(--crt-rule)] pt-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(event);
              }
            }}
            rows={2}
            disabled={streaming}
            placeholder="Write your reply…"
            className="crt-input resize-y"
          />
          <button
            type="submit"
            className="crt-button crt-button-primary mt-3"
            disabled={streaming || !draft.trim()}
          >
            {streaming ? "Listening…" : "Send"}
          </button>
        </form>
      </Panel>

      {error ? (
        <div className="mt-4">
          <ErrorBox title="Tutor unavailable" message={error} />
        </div>
      ) : null}
    </>
  );
}
