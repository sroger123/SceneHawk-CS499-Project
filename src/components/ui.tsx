import Link from "next/link";

// Shared UI primitives in the CoDeed house style. Pages compose these instead
// of re-typing class strings.

type Children = { children: React.ReactNode };

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/* ─── Layout ──────────────────────────────────────────────── */

/** The page column: 1180px wide with fluid side gutters. */
export const containerClass =
  "mx-auto w-full max-w-[1180px] px-[clamp(20px,5vw,64px)]";

export function Container({
  children,
  className,
}: Children & { className?: string }) {
  return <div className={cx(containerClass, className)}>{children}</div>;
}

/** A full-width section with a hairline on top; `soft` gives the darker band. */
export function Band({
  children,
  soft,
  id,
  className,
  innerClassName,
}: Children & {
  soft?: boolean;
  id?: string;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cx("border-t border-line", soft && "bg-surface", className)}
    >
      <Container className={cx("py-[clamp(56px,9vh,110px)]", innerClassName)}>
        {children}
      </Container>
    </section>
  );
}

/* ─── Brand ───────────────────────────────────────────────── */

export function Wordmark({ size = "text-[22px]" }: { size?: string }) {
  return (
    <span
      translate="no"
      className={cx("font-display font-semibold tracking-[-0.02em] text-fg", size)}
    >
      Scene<span className="text-accent">Hawk</span>
    </span>
  );
}

/* ─── Buttons ─────────────────────────────────────────────── */

export function buttonClass(
  variant: "primary" | "secondary" | "light" | "ghost" = "primary",
  size: "md" | "lg" = "md",
) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[0.01em] transition-[color,background-color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50",
    size === "lg" ? "px-6 py-[13px] text-[15px]" : "px-[18px] py-[9px] text-sm",
    variant === "primary" && "bg-accent text-fg hover:bg-accent-hi",
    variant === "secondary" &&
      "border border-line-strong text-fg hover:border-fg-faint hover:bg-surface-2",
    variant === "light" && "bg-fg text-canvas hover:bg-fg-muted",
    variant === "ghost" && "text-fg-muted hover:text-fg",
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-canvas px-4 py-3 text-[15px] text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none";

/* ─── Type ────────────────────────────────────────────────── */

/** Mono, uppercase, accent: the label above a hero or page title. */
export function Eyebrow({ children, className }: Children & { className?: string }) {
  return (
    <p
      className={cx(
        "font-mono text-xs uppercase tracking-[0.14em] text-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Mono, uppercase, faint: small labels beside headings and above lists. */
export function Label({ children, className }: Children & { className?: string }) {
  return (
    <p
      className={cx(
        "font-mono text-xs uppercase tracking-[0.08em] text-fg-faint",
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
        "pb-10 pt-[clamp(40px,7vh,72px)]",
        center && "mx-auto max-w-2xl text-center",
      )}
    >
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="font-display text-[clamp(30px,4.4vw,48px)] leading-[1.05] tracking-[-0.02em]">
        {title}
      </h1>
      {lead && (
        <p
          className={cx(
            "mt-4 max-w-[62ch] text-[15px] leading-relaxed text-fg-muted",
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

/** A section heading in the house serif. */
export function SectionTitle({
  children,
  className,
  as: As = "h2",
}: Children & { className?: string; as?: "h2" | "h3" }) {
  return (
    <As
      className={cx(
        "font-display text-[clamp(26px,3.6vw,38px)] leading-[1.1] tracking-[-0.01em]",
        className,
      )}
    >
      {children}
    </As>
  );
}

/** The one accent word in a display heading. Italic, as in "feel." */
export function Em({ children }: Children) {
  return <em className="text-accent">{children}</em>;
}

/* ─── Containers ──────────────────────────────────────────── */

const cardBase = "rounded-[14px] border border-line";

export function Card({
  children,
  className,
  href,
  tone = "surface",
}: Children & { className?: string; href?: string; tone?: "surface" | "canvas" }) {
  const bg = tone === "canvas" ? "bg-canvas" : "bg-surface";
  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          cardBase,
          bg,
          "group block transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-surface-2",
          className,
        )}
      >
        {children}
      </Link>
    );
  }
  return <div className={cx(cardBase, bg, className)}>{children}</div>;
}

export function Notice({ children }: Children) {
  return (
    <p className="rounded-xl border border-warn-line bg-warn-bg px-4 py-3 text-xs leading-relaxed text-warn">
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs leading-5",
        tone === "default" && "border-line-strong text-fg-muted",
        tone === "accent" &&
          "border-accent font-mono text-[11px] uppercase tracking-[0.08em] text-accent",
        tone === "warn" && "border-warn-line bg-warn-bg text-warn",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Clickable pill: starter prompts, collection items, system toggles. */
export function pillClass(active = false) {
  return cx(
    "inline-flex items-center rounded-full border px-4 py-2 text-[13px] transition-[color,border-color,background-color] duration-150",
    active
      ? "border-accent text-accent"
      : "border-line-strong text-fg-muted hover:border-fg-faint hover:text-fg",
  );
}

export function Arrow() {
  return (
    <span
      aria-hidden
      className="inline-block transition-transform duration-150 group-hover:translate-x-[3px]"
    >
      →
    </span>
  );
}
