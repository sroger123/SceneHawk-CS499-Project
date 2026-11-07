import Link from "next/link";

// Shared UI primitives. Pages compose these instead of re-typing class
// strings, so the look stays consistent.

type Children = { children: React.ReactNode };

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/* ─── Buttons ─────────────────────────────────────────────── */

export function buttonClass(
  variant: "primary" | "secondary" | "ghost" = "primary",
  size: "md" | "lg" = "md",
) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px active:translate-y-px active:scale-[.985] disabled:pointer-events-none disabled:opacity-50",
    size === "lg" ? "px-6 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm",
    variant === "primary" && "bg-accent text-canvas hover:bg-accent-hi",
    variant === "secondary" &&
      "border border-line-strong text-fg hover:border-fg-faint hover:bg-surface-2",
    variant === "ghost" && "text-fg-muted hover:text-fg",
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

/* ─── Type ────────────────────────────────────────────────── */

export function Eyebrow({ children, className }: Children & { className?: string }) {
  return (
    <p
      className={cx(
        "text-sm font-medium text-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Small uppercase label above a list or block. */
export function Label({ children, className }: Children & { className?: string }) {
  return (
    <p
      className={cx(
        "text-sm font-medium text-fg-subtle",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  center,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className={cx(
        "pb-10 pt-12 md:pt-16",
        center && "mx-auto max-w-2xl text-center",
      )}
    >
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="text-balance font-display text-4xl leading-[1.1] tracking-tight md:text-5xl">
        {title}
      </h1>
      {lead && (
        <p
          className={cx(
            "mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-fg-subtle",
            center && "mx-auto",
          )}
        >
          {lead}
        </p>
      )}
      {actions && <div className="mt-6">{actions}</div>}
    </header>
  );
}

/** The one italic-accent word in a display heading (use sparingly). */
export function Em({ children }: Children) {
  return <em className="text-accent">{children}</em>;
}

/* ─── Containers ──────────────────────────────────────────── */

const cardBase = "rounded-xl border border-line bg-surface";

export function Card({
  children,
  className,
  href,
}: Children & { className?: string; href?: string }) {
  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          cardBase,
          "group block transition-[border-color,background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-2 hover:shadow-[0_12px_24px_-12px_rgb(0_0_0/0.5)]",
          className,
        )}
      >
        {children}
      </Link>
    );
  }
  return <div className={cx(cardBase, className)}>{children}</div>;
}

export function Notice({ children }: Children) {
  return (
    <p className="rounded-lg border border-warn-line bg-warn-bg px-4 py-3 text-xs leading-relaxed text-warn">
      {children}
    </p>
  );
}

/* ─── Tags & chips ────────────────────────────────────────── */

export function Tag({
  children,
  tone = "default",
  className,
}: Children & { tone?: "default" | "accent" | "warn"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] leading-5",
        tone === "default" && "border-line-strong/70 bg-surface-2 text-fg-muted",
        tone === "accent" && "border-accent/30 bg-accent-soft text-accent",
        tone === "warn" && "border-warn-line bg-warn-bg text-warn",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Clickable pill — starter prompts, collection items, system toggles. */
export function pillClass(active = false) {
  return cx(
    "inline-flex items-center rounded-full border px-4 py-2 text-xs transition-[color,border-color,transform] duration-150",
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-line bg-surface text-fg-muted hover:-translate-y-px hover:border-line-strong hover:text-fg",
  );
}

export function Arrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 transition-transform duration-150 group-hover:translate-x-[3px]"
    >
      <path
        d="M3 8h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
