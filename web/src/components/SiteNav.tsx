"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark, buttonClass, containerClass } from "@/components/ui";

const NAV = [
  { label: "Search", href: "/search" },
  { label: "Chat", href: "/chat" },
  { label: "Analysis", href: "/catalog" },
  { label: "Collections", href: "/collections" },
];

// Sticky, blurred header in the CoDeed style: wordmark, quiet links, one
// light pill. Below 720px the links fold into a menu button.
export default function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    path === href || path.startsWith(`${href}/`);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (n: (typeof NAV)[number], extra = "") => (
    <Link
      key={n.href}
      href={n.href}
      aria-current={isActive(n.href) ? "page" : undefined}
      className={`text-sm tracking-[0.01em] transition-colors ${
        isActive(n.href) ? "text-fg" : "text-fg-muted hover:text-fg"
      } ${extra}`}
    >
      {n.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/70 backdrop-blur-[10px]">
      <nav aria-label="Main" className={`${containerClass} py-5`}>
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="SceneHawk home">
            <Wordmark />
          </Link>

          <div className="hidden items-center gap-[clamp(16px,3vw,32px)] min-[720px]:flex">
            {NAV.map((n) => link(n))}
            <Link href="/search" className={buttonClass("light")}>
              Start a search
            </Link>
          </div>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong min-[720px]:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {open ? (
                <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div
            id="mobile-menu"
            className="mt-[18px] flex flex-col gap-1 border-t border-line pt-4 min-[720px]:hidden"
          >
            {NAV.map((n) => link(n, "px-0.5 py-2.5"))}
            <Link href="/search" className={`${buttonClass("light")} mt-2`}>
              Start a search
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
