import type { LLMClient } from "@/lib/llm/client";
import {
  emptyInterpretation,
  type QueryInterpretation,
} from "@/lib/types";
import { containsPhrase } from "@/lib/retrieval/text";

// ─── Agent 1: Query Interpreter ─────────────────────────────────
//
// Turns "something isolated and unsettling where the tension builds
// slowly without jump scares" into a structured cinematic-concept
// representation — the key step that lets the system search by
// experience rather than by genre label.
//
// Two implementations behind one function:
//   - LLM: structured JSON extraction (when OPENAI_API_KEY is set)
//   - Heuristic: lexicon matching (default; deterministic baseline)

const LEXICON: Record<
  keyof Pick<
    QueryInterpretation,
    "themes" | "mood" | "pacing" | "narrative" | "visual" | "avoid" | "genres"
  >,
  string[]
> = {
  themes: [
    "isolation", "loneliness", "grief", "identity", "memory", "madness",
    "obsession", "guilt", "faith", "family", "love", "loss", "class",
    "power", "revenge", "mortality", "death", "time", "nature", "alienation",
    "coming of age", "masculinity", "desire", "jealousy", "paranoia",
    "survival", "morality", "corruption", "redemption", "trauma",
    "existential", "dreams", "reality", "free will", "technology",
  ],
  mood: [
    "unsettling", "dread", "melancholic", "melancholy", "tense", "tension",
    "claustrophobic", "eerie", "bleak", "haunting", "dreamlike", "surreal",
    "intimate", "romantic", "tender", "wistful", "nostalgic", "ominous",
    "oppressive", "hypnotic", "meditative", "contemplative", "quiet",
    "anxious", "disturbing", "unnerving", "atmospheric", "dark", "brooding",
    "lonely", "isolating", "mysterious", "enigmatic", "beautiful",
    "violent", "brutal", "suspenseful", "thrilling", "whimsical",
    "bittersweet", "hopeful", "devastating", "cerebral",
  ],
  pacing: [
    "slow", "slow burn", "slow-burn", "deliberate", "measured", "patient",
    "fast", "propulsive", "relentless", "gradual", "builds slowly",
    "meditative", "unhurried", "brisk", "breakneck",
  ],
  narrative: [
    "twist", "ambiguous", "nonlinear", "non-linear", "unreliable narrator",
    "character study", "character-driven", "plot-driven", "minimal dialogue",
    "dialogue-heavy", "vignette", "episodic", "descent into madness",
    "psychological", "mystery", "investigation", "procedural", "allegory",
    "allegorical", "symbolic", "open ending", "subtext", "slow reveal",
    "unpredictable", "layered", "complex", "simple", "fable",
  ],
  visual: [
    "cinematography", "visual", "visually", "beautiful", "stunning",
    "long takes", "long take", "static camera", "handheld", "black and white",
    "black-and-white", "monochrome", "colorful", "vivid", "desaturated",
    "neon", "low-key lighting", "natural light", "composition", "framing",
    "wide shots", "close-ups", "tracking shot", "dreamlike imagery",
    "practical effects", "visual storytelling", "striking imagery",
    "painterly", "symmetrical", "atmospheric visuals",
  ],
  avoid: [
    "jump scares", "jumpscares", "gore", "gory", "torture", "gratuitous",
    "violence", "nudity", "happy", "sentimental", "predictable",
    "mainstream", "obvious", "long", "slow",
  ],
  genres: [
    "horror", "thriller", "drama", "sci-fi", "science fiction", "comedy",
    "romance", "action", "mystery", "crime", "fantasy", "animation",
    "documentary", "western", "noir", "psychological thriller",
    "psychological horror",
  ],
};

const NEGATION_PATTERNS = [
  /\b(?:without|no|not|avoid|avoiding|don't want|doesn't rely on|rather than|instead of|free of|lacking|isn't|aren't)\b/gi,
];

const OBSCURE_SIGNALS = [
  "obscure", "hidden gem", "hidden gems", "underrated", "unknown",
  "lesser-known", "lesser known", "not obvious", "not mainstream",
  "wouldn't discover", "unusual", "offbeat", "niche", "cult",
  "don't give me the obvious",
];

const POPULAR_SIGNALS = [
  "popular", "mainstream", "well-known", "famous", "classic", "canonical",
  "what's everyone watching", "trending",
];

function extractNegated(query: string): string[] {
  // Find phrases following negation cues: "without jump scares",
  // "not too violent", "doesn't rely on gore".
  const found = new Set<string>();
  const lower = query.toLowerCase();
  for (const pattern of NEGATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lower)) !== null) {
      const tail = lower.slice(match.index, match.index + 80);
      for (const term of LEXICON.avoid) {
        if (tail.includes(term)) found.add(term);
      }
      // also catch multi-word nouns after the negation for the avoid list
      const m2 = tail.match(/(?:without|no|avoid|avoiding|free of)\s+([a-z\s-]{3,30}?)(?:[,.]|$)/);
      if (m2) {
        for (const term of LEXICON.avoid) {
          if (m2[1].includes(term)) found.add(term);
        }
      }
    }
  }
  return [...found];
}

// Deterministic lexicon-based interpretation — also serves as the
// fallback if the LLM returns unparseable output.
export function heuristicInterpret(query: string): QueryInterpretation {
  const interp = emptyInterpretation(query);
  const lower = query.toLowerCase();

  const collect = (terms: string[]) =>
    terms.filter((t) => containsPhrase(lower, t));

  interp.themes = collect(LEXICON.themes);
  interp.mood = collect(LEXICON.mood);
  interp.pacing = collect(LEXICON.pacing);
  interp.narrative = collect(LEXICON.narrative);
  interp.visual = collect(LEXICON.visual);
  interp.genres = collect(LEXICON.genres);
  interp.avoid = extractNegated(query);

  // "slow" appearing in an avoid context ("not too slow") shouldn't also
  // register as desired pacing.
  if (interp.avoid.includes("slow")) {
    interp.pacing = interp.pacing.filter((p) => p !== "slow");
  }

  interp.preferObscure = OBSCURE_SIGNALS.some((s) => containsPhrase(lower, s));
  interp.preferPopular =
    !interp.preferObscure &&
    POPULAR_SIGNALS.some((s) => containsPhrase(lower, s));

  return interp;
}

const INTERPRET_SYSTEM = `You are the query-interpretation agent of a film-discovery system. Convert the user's natural-language request into structured cinematic-search criteria. Reply with JSON only, matching exactly this shape:
{"themes":[],"mood":[],"pacing":[],"narrative":[],"visual":[],"avoid":[],"genres":[],"preferObscure":false,"preferPopular":false}
Rules:
- themes: abstract subject matter (isolation, grief, class, memory...)
- mood: emotional atmosphere (unsettling, melancholic, dreamy...)
- pacing: tempo descriptors (slow burn, propulsive, meditative...)
- narrative: structure/storytelling features (ambiguous ending, nonlinear, minimal dialogue, character study...)
- visual: cinematography/style features (long takes, low-key lighting, black and white...)
- avoid: things the user explicitly does NOT want (jump scares, gore...)
- genres: only genres the user explicitly named
- preferObscure: true if they want hidden/lesser-known/unusual picks
- preferPopular: true if they want well-known/popular picks
Use concise lowercase phrases. Empty arrays are fine — extract only what's actually expressed.`;

export async function interpretQuery(
  query: string,
  llm: LLMClient,
): Promise<QueryInterpretation> {
  if (llm.isMock) return heuristicInterpret(query);

  try {
    const raw = await llm.complete(
      `User request: "${query}"`,
      { system: INTERPRET_SYSTEM, json: true, temperature: 0 },
    );
    const parsed = JSON.parse(raw);
    const interp = emptyInterpretation(query);
    interp.themes = parsed.themes ?? [];
    interp.mood = parsed.mood ?? [];
    interp.pacing = parsed.pacing ?? [];
    interp.narrative = parsed.narrative ?? [];
    interp.visual = parsed.visual ?? [];
    interp.avoid = parsed.avoid ?? [];
    interp.genres = parsed.genres ?? [];
    interp.preferObscure = !!parsed.preferObscure;
    interp.preferPopular = !!parsed.preferPopular;
    interp.source = "llm";
    return interp;
  } catch {
    return heuristicInterpret(query);
  }
}
