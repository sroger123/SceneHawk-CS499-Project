"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, inputClass, pillClass } from "@/components/ui";

interface RetrievedFilm {
  title?: string;
  year?: number | string;
  rating?: number;
  pacing?: string;
  pool?: string;
  summary?: string;
  similarity?: number;
  genres?: string[];
  feelings?: Record<string, number>;
  evidence?: string;
  evidence_feeling?: string;
  review_count?: number;
  low_confidence?: boolean;
}

function FilmResult({ f }: { f: RetrievedFilm }) {
  const feelings = Object.entries(f.feelings ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <li className="rounded-[14px] border border-line bg-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-fg">
          {f.title}
          {f.year ? <span className="font-normal text-fg-faint"> · {f.year}</span> : null}
        </p>
        {typeof f.similarity === "number" && (
          <span
            className="shrink-0 font-mono text-xs tabular-nums text-accent"
            title="Retrieval score: how well the film's feeling and description scores fit your request. Not a quality rating."
          >
            match {Math.round(f.similarity * 100)}
          </span>
        )}
      </div>
      {feelings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {feelings.map(([name, score]) => (
            <span
              key={name}
              className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs leading-5 text-fg-muted"
            >
              {name} <span className="tabular-nums text-fg-faint">{score.toFixed(2)}</span>
            </span>
          ))}
          {f.low_confidence && (
            <span
              className="rounded-full border border-warn-line px-2.5 py-0.5 font-mono text-[10px] uppercase leading-5 tracking-[0.08em] text-warn"
              title="Scores come from only a few reviews."
            >
              low confidence{f.review_count ? ` · ${f.review_count} reviews` : ""}
            </span>
          )}
        </div>
      )}
      {f.evidence && (
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
          <span className="text-fg-faint">
            From a review{f.evidence_feeling ? ` (${f.evidence_feeling})` : ""}:
          </span>{" "}
          “{f.evidence.trim()}{f.evidence.length >= 280 ? "…" : ""}”
        </p>
      )}
    </li>
  );
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  films?: RetrievedFilm[];
}

const STARTERS = [
  "something cozy for a rainy Sunday",
  "a tense slow-burn that builds dread",
  "a melancholic film about loneliness",
  "a hopeful sci-fi about first contact",
];

export default function ChatPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as { reply?: string; films?: RetrievedFilm[] };
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply ?? "No reply came back. Try sending your message again.",
          films: data.films,
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I couldn’t reach the recommendation service. Check that the chatbot server is running, then send your message again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface">
      {/* Conversation */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="max-h-[55vh] overscroll-contain min-h-[220px] space-y-5 overflow-y-auto px-5 py-6 sm:px-6"
      >
        {turns.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-fg-subtle">
              Ask for a film by mood, pacing or tone.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className={pillClass()}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] break-words rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-fg">
                {t.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="min-w-0 max-w-[90%] space-y-3">
                <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-line bg-canvas px-4 py-3 text-sm leading-relaxed text-fg">
                  {t.text}
                </div>
                {t.films && t.films.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-fg-subtle">
                      Matching films
                    </p>
                    <ul className="space-y-2">
                      {t.films.map((f, j) => (
                        <FilmResult key={j} f={f} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-line bg-canvas px-4 py-3 text-sm text-fg-subtle">
              Searching the feelings table…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex gap-3 border-t border-line p-4"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          name="message"
          autoComplete="off"
          enterKeyHint="send"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="A tense slow-burn that builds dread…"
          className={`${inputClass} flex-1 bg-canvas`}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={buttonClass("primary")}
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
