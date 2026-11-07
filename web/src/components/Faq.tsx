"use client";

import { useState } from "react";
import { Band, cx } from "@/components/ui";

export interface FaqItem {
  q: string;
  /** One string per paragraph. */
  a: string[];
}

// "Questions, answered": the CoDeed FAQ. Numbered rows, one open at a time,
// the first open on load.
export default function Faq({ items, id }: { items: FaqItem[]; id?: string }) {
  const [open, setOpen] = useState(0);

  return (
    <Band id={id} innerClassName="!py-[clamp(48px,8vh,96px)]">
      <div className="grid items-start gap-[clamp(32px,5vw,72px)] min-[720px]:grid-cols-[minmax(220px,0.7fr)_1.6fr]">
        <h2 className="font-display text-[clamp(34px,5vw,56px)] leading-[1.02] tracking-[-0.02em]">
          Questions,
          <br />
          <em className="text-accent">answered</em>
        </h2>

        <div>
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-line">
                <button
                  type="button"
                  id={`faq-q-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center gap-4 px-1 py-[22px] text-left"
                >
                  <span className="min-w-6 font-mono text-[13px] text-fg-faint">
                    Q{i + 1}
                  </span>
                  <span className="flex-1 text-[clamp(16px,2vw,19px)] font-medium text-fg">
                    {f.q}
                  </span>
                  <span
                    aria-hidden
                    className={cx(
                      "text-lg transition-[transform,color] duration-200",
                      isOpen ? "rotate-180 text-accent" : "text-fg-faint",
                    )}
                  >
                    ⌄
                  </span>
                </button>
                {isOpen && (
                  <div
                    id={`faq-a-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className="space-y-3.5 pb-[26px] pl-11 pr-1"
                  >
                    {f.a.map((p, j) => (
                      <p key={j} className="text-[15px] leading-[1.65] text-fg-muted">
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Band>
  );
}
