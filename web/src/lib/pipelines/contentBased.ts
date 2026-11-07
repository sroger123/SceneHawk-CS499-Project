import type {
  AgentContext,
  FilmScore,
  QueryInterpretation,
} from "@/lib/types";

// ─── System A: conventional content-based baseline ──────────────
//
// Recommends purely from traditional metadata signals: genre labels,
// director, and literal keyword overlap on the theme tags (the closest
// thing a conventional system has to "content"). No analytical chunks,
// no atmosphere/narrative/visual reasoning, no interpretation of intent.
//
// This is the weak baseline the research compares against — it's meant
// to fail on queries like "unsettling slow burn without jump scares"
// because nothing in its model represents those concepts.

const GENRE_WORDS = [
  "horror", "thriller", "drama", "sci-fi", "science fiction", "comedy",
  "romance", "action", "mystery", "crime", "fantasy", "animation",
  "documentary", "western", "noir",
];

export function runContentBased(
  interp: QueryInterpretation,
  ctx: AgentContext,
): FilmScore[] {
  const q = interp.raw.toLowerCase();
  const wantedGenres = GENRE_WORDS.filter((g) => q.includes(g));
  const scores: FilmScore[] = [];

  for (const film of ctx.films) {
    const m = film.metadata;
    let score = 0;
    const why: string[] = [];

    // Genre overlap — the dominant signal in conventional systems
    const genreHits = wantedGenres.filter((g) =>
      m.genres.some((fg) => fg.toLowerCase().includes(g)),
    );
    if (genreHits.length) {
      score += 0.4 + 0.15 * genreHits.length;
      why.push(`Genre match: ${genreHits.join(", ")}`);
    }

    // Director mentioned by name
    if (q.includes(m.director.toLowerCase())) {
      score += 0.5;
      why.push(`Directed by ${m.director}`);
    }

    // Literal keyword overlap on theme tags (i.e. "keywords" metadata)
    const kwHits = film.themes.filter((t) => q.includes(t.toLowerCase()));
    if (kwHits.length) {
      score += 0.1 * kwHits.length;
      why.push(`Keyword match: ${kwHits.join(", ")}`);
    }

    // Popularity prior — conventional systems lean on it heavily
    score += { popular: 0.12, acclaimed: 0.08, cult: 0.04, obscure: 0 }[
      m.popularity
    ];

    if (score <= 0.1) continue;
    const clamped = Math.min(1, score);
    scores.push({
      film,
      score: clamped,
      displayScore: Math.round(35 + clamped * 50),
      dimensionScores: {},
      matchedTerms: {},
      why,
    });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, 8);
}
