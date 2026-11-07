"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui";

export default function SearchBox({
  initial = "",
  mode = "multi",
  autoFocus = false,
}: {
  initial?: string;
  mode?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState(initial);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}&mode=${mode}`);
  }

  return (
    <form onSubmit={submit} role="search" className="w-full">
      <div className="flex flex-col gap-2 rounded-[14px] border border-line-strong bg-surface p-2 transition-colors focus-within:border-accent sm:flex-row sm:items-center sm:rounded-full sm:pl-2">
        <label htmlFor="scenehawk-search" className="sr-only">
          Describe the film you want
        </label>
        <div className="flex flex-1 items-center gap-3 px-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className="shrink-0 text-fg-faint"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id="scenehawk-search"
            name="q"
            autoComplete="off"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Something unsettling and slow-burning…"
            className="w-full bg-transparent py-3 text-base text-fg placeholder:text-fg-faint focus:outline-none"
            autoFocus={autoFocus}
          />
        </div>
        <button type="submit" className={buttonClass("primary", "lg")}>
          Find films
        </button>
      </div>
    </form>
  );
}
