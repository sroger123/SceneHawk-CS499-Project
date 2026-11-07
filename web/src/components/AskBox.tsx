"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

interface AskResponse {
  answer: string;
  source: "llm" | "template";
  dimension?: string;
}

export default function AskBox({ filmId }: { filmId: string }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<
    { q: string; r: AskResponse }[]
  >([]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/films/${filmId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as AskResponse;
      setResponses((prev) => [{ q: question, r }, ...prev]);
      setQ("");
    } catch {
      setError("The answer didn’t load. Check your connection and ask again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
      <form onSubmit={ask} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`ask-${filmId}`} className="sr-only">
          Your question about this film
        </label>
        <input
          id={`ask-${filmId}`}
          name="question"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Why does this feel unsettling…"
          className={`${inputClass} flex-1 bg-canvas`}
        />
        <button
          type="submit"
          disabled={loading}
          className={buttonClass("primary")}
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-4 text-sm text-warn">
            {error}
          </p>
        )}
        {responses.length > 0 && (
          <div className="mt-5 space-y-4">
            {responses.map(({ q, r }, idx) => (
              <div key={responses.length - idx} className="border-t border-line pt-4">
                <p className="break-words text-sm text-fg-subtle">{q}</p>
                <p className="mt-2 text-sm leading-relaxed text-fg">
                  {r.answer}
                </p>
                {r.dimension && (
                  <p className="mt-2 text-xs text-fg-faint">
                    Based on the {r.dimension} analysis · {r.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
