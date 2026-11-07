import Link from "next/link";
import Faq, { type FaqItem } from "@/components/Faq";
import {
  Arrow,
  Band,
  Card,
  Container,
  Em,
  Eyebrow,
  Label,
  SectionTitle,
  buttonClass,
} from "@/components/ui";
import { PIPELINE_LABELS, PIPELINE_MODES, type PipelineMode } from "@/lib/types";

// Defines the three discovery steps
const STEPS = [
  {
    title: "You describe a mood",
    body: "Atmosphere, pacing and visual style, in your own words. For example: isolated and unsettling, slow burn, no jump scares.",
  },
  {
    title: "Agents search the analysis",
    body: "Separate agents look for evidence in themes, mood, narrative structure and cinematography.",
  },
  {
    title: "You get ranked matches",
    body: "Each film comes with a reason, taken from the analysis it was found in.",
  },
];

const SYSTEM_BLURBS: Record<PipelineMode, string> = {
  content: "Genre, director and keyword overlap. The conventional baseline.",
  llm: "The query goes straight to a language model, with no retrieval at all.",
  rag: "One retrieval pass over the whole analytical corpus, then rank and explain.",
  multi: "Specialized agents retrieve per dimension; a ranker fuses their evidence.",
};

// Why SceneHawk, in the CoDeed "Why CoDeed" layout
const DIFFS = [
  {
    t: "Search by feeling, not genre",
    b: "Ask for “cozy for a rainy Sunday” or “a tense slow burn” and get films that feel that way, not just films with the right label.",
  },
  {
    t: "Evidence with every pick",
    b: "Each match shows the scores behind it and the review or analysis it came from, so a recommendation can be checked.",
  },
  {
    t: "Our own feelings model",
    b: "A fine-tuned model reads film reviews and scores 28 feelings. Every film gets one fixed profile, so the same film always scores the same.",
  },
];

// The feelings pipeline, in the CoDeed "cross-border" band layout
const PIPELINE = [
  {
    t: "Reviews in, feelings out",
    b: "The model reads each review and scores what the viewer felt: tense, moved, amused and 25 more.",
  },
  {
    t: "One profile per film",
    b: "Review scores are averaged per film. Films with few reviews are marked low confidence.",
  },
  {
    t: "Matched with the story",
    b: "Your feeling words are matched against the profiles, your story words against each description.",
  },
];

// Stores questions and answers
const FAQS: FaqItem[] = [
  {
    q: "What is SceneHawk?",
    a: [
      "A film discovery system that searches by experience (atmosphere, pacing and visual language) instead of genre labels or ratings.",
      "Under the hood, it's a multi-agent pipeline running over a curated analytical film corpus, plus a feelings model trained on film reviews.",
    ],
  },
  {
    q: "Do I need an account?",
    a: [
      "No. SceneHawk only searches a public film corpus. There's nothing personal to store or protect, so there's no sign-in.",
    ],
  },
  {
    q: "How is this different from IMDb or Netflix?",
    a: [
      "IMDb indexes metadata; Netflix ranks by watch history and genre. SceneHawk retrieves how films actually feel (the dread, the pacing, the cinematography) and explains why each match fits your request.",
    ],
  },
  {
    q: "Where does the film analysis come from?",
    a: [
      "A curated knowledge base of structured analytical profiles: themes, atmosphere, narrative structure, visual style and technique for each film.",
      "The corpus is deliberately small but deep. This is a research prototype, not a catalog of everything.",
    ],
  },
  {
    q: "What does a match score actually mean?",
    a: [
      "It's a retrieval score: how strongly a film's profile matches the criteria you described. It's not a quality rating and isn't scientifically validated. It's evidence weight, honestly labeled.",
    ],
  },
  {
    q: "Why recommend films I've never heard of?",
    a: [
      "Conventional systems surface the same popular titles. SceneHawk's corpus deliberately includes cult and obscure films, and matching on experience rather than popularity helps surface titles that genre filters bury.",
    ],
  },
];

// Renders the main homepage content
export default function Home() {
  return (
    <div>
      {/* ─── Hero ─────────────────────────────────────────── */}
      {/* Kept on purpose: the team chose this headline over a plainer one. */}
      <Container>
        <header className="pb-[clamp(48px,8vh,96px)] pt-[clamp(56px,10vh,96px)]">
          <Eyebrow className="mb-6">Multi-agent film discovery</Eyebrow>
          <h1 className="max-w-[18ch] font-display text-[clamp(38px,7vw,88px)] leading-[1.02] tracking-[-0.03em]">
            Describe the film
            <br />
            you want to <Em>feel.</Em>
          </h1>
          <p className="mt-7 max-w-[52ch] text-[clamp(16px,2vw,20px)] leading-[1.55] text-fg-muted">
            For people who know what kind of evening they want but not which
            title delivers it. Search by atmosphere, pacing, and visual
            language instead of genre, rating, or what you watched last.
          </p>
          <div className="mt-10 flex flex-wrap gap-3.5">
            <Link href="/search" className={`${buttonClass("primary", "lg")} group`}>
              Start a search <Arrow />
            </Link>
            <a href="#how-it-works" className={buttonClass("secondary", "lg")}>
              See how it works
            </a>
          </div>
        </header>
      </Container>

      {/* ─── How it works ─────────────────────────────────── */}
      <Band soft id="how-it-works" innerClassName="!py-[clamp(48px,8vh,96px)]">
        <SectionTitle className="max-w-[22ch]">How the search works</SectionTitle>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-fg-muted">
          Three steps from a feeling to a film, with the evidence attached.
        </p>
        <div className="mt-10 grid gap-7 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {STEPS.map((s) => (
            <Card key={s.title} tone="canvas" className="px-[22px] py-6">
              <h3 className="mb-2 font-display text-[19px]">{s.title}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </Band>

      {/* ─── The four systems ─────────────────────────────── */}
      <Band soft innerClassName="!py-[clamp(40px,6vh,72px)]" className="border-b">
        <div className="mb-9 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[clamp(22px,3vw,30px)]">
            Four search systems, compared
          </h2>
          <Label>Research comparison</Label>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-[14px] bg-line">
          {PIPELINE_MODES.map((m) => (
            <li key={m}>
              <Link
                href={`/search?mode=${m}`}
                className="grid items-center gap-x-[clamp(16px,3vw,40px)] gap-y-2 bg-canvas px-[clamp(18px,3vw,28px)] py-[22px] transition-colors hover:bg-surface-2 sm:grid-cols-[1.1fr_1.6fr_auto]"
              >
                <span className="text-base font-medium text-fg">{PIPELINE_LABELS[m]}</span>
                <span className="text-sm leading-relaxed text-fg-muted">{SYSTEM_BLURBS[m]}</span>
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-fg-faint sm:text-right">
                  {m === "multi" ? <span className="text-accent">Default</span> : "Compare"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Band>

      {/* ─── Why SceneHawk ────────────────────────────────── */}
      <Container>
        <section className="grid items-start gap-[clamp(28px,5vw,72px)] py-[clamp(56px,9vh,110px)] min-[720px]:grid-cols-[minmax(220px,0.8fr)_1.6fr]">
          <h2 className="font-display text-[clamp(28px,4vw,44px)] leading-[1.05] tracking-[-0.02em]">
            Why <span className="text-accent">SceneHawk</span>
          </h2>
          <div>
            {DIFFS.map((d, i) => (
              <div
                key={d.t}
                className={i === 0 ? "pb-[22px]" : "border-t border-line py-[22px]"}
              >
                <h3 className="mb-2 font-display text-[22px]">{d.t}</h3>
                <p className="max-w-[58ch] text-[15px] leading-relaxed text-fg-muted">{d.b}</p>
              </div>
            ))}
          </div>
        </section>
      </Container>

      {/* ─── The feelings model ───────────────────────────── */}
      <Band soft>
        <SectionTitle className="max-w-[24ch]">
          A feelings model trained on what viewers felt
        </SectionTitle>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-fg-muted">
          Ratings say whether people liked a film. Reviews say how it felt. We
          fine-tuned a model to read reviews for 28 feelings and built a profile
          for every film from them.
        </p>
        <div className="mt-9 grid gap-7 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {PIPELINE.map((c) => (
            <div key={c.t}>
              <h3 className="mb-2 font-display text-lg">{c.t}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{c.b}</p>
            </div>
          ))}
        </div>
        <Link href="/chat" className={`${buttonClass("secondary", "lg")} group mt-8`}>
          Try the feelings chat <Arrow />
        </Link>
      </Band>

      {/* ─── Closing ──────────────────────────────────────── */}
      <section className="border-t border-line px-5 py-[clamp(56px,9vh,110px)] text-center">
        <h2 className="font-display text-[clamp(28px,4vw,48px)] tracking-[-0.02em]">
          Films, found by <Em>feeling.</Em>
        </h2>
        <div className="mt-7">
          <Link href="/search" className={`${buttonClass("primary", "lg")} group`}>
            Start a search <Arrow />
          </Link>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <Faq id="faq" items={FAQS} />
    </div>
  );
}
