import type {
  Dimension,
  DimensionResult,
  Film,
  FilmScore,
  QueryInterpretation,
} from "@/lib/types";

// ─── Agent 5a: Recommendation / Exploration ranker ──────────────
//
// Aggregates the dimension agents' evidence into a single ranked list.
// Applies:
//   - dimension weighting (a query that only expresses mood shouldn't
//     let a film coast in on visual matches)
//   - "avoid" penalties (e.g. user said no jump scares)
//   - popularity nudges (obscure-seeking vs popular-seeking)
//
// `displayScore` is a retrieval/ranking score — labelled "Cinematic
// Match" in the UI and deliberately NOT presented as a validated metric.

const DIMENSION_WEIGHT: Record<Dimension, number> = {
  themes: 1.2,
  atmosphere: 1.2,
  narrative: 1.0,
  visual: 1.0,
  characters: 0.6,
};

const JUMP_SCARE_PENALTY: Record<string, number> = {
  none: 0,
  minimal: 0.08,
  moderate: 0.2,
  heavy: 0.4,
};

const POPULARITY_RANK: Record<string, number> = {
  obscure: 0,
  cult: 1,
  acclaimed: 2,
  popular: 3,
};

function normalizeScores(hits: DimensionResult["hits"]): Map<string, number> {
  const max = Math.max(...hits.map((h) => h.score), 0);
  const map = new Map<string, number>();
  if (max <= 0) return map;
  for (const h of hits) map.set(h.chunk.filmId, h.score / max);
  return map;
}

function matchedTermsFor(
  hits: DimensionResult["hits"],
  filmId: string,
): string[] {
  const hit = hits.find((h) => h.chunk.filmId === filmId);
  return hit?.matchedTerms ?? [];
}

function buildWhy(
  film: Film,
  interp: QueryInterpretation,
  matched: Partial<Record<Dimension, string[]>>,
): string[] {
  const why: string[] = [];
  const m = film.metadata;

  if (matched.themes?.length) {
    const t = film.themes.slice(0, 3).join(", ");
    why.push(`Themes align: ${t}`);
  }
  if (matched.atmosphere?.length) {
    why.push(`Atmosphere: ${film.atmosphere.slice(0, 3).join(", ")}`);
  }
  if (matched.narrative?.length) {
    why.push(
      `Pacing/structure: ${film.narrative.pacing}, ${film.narrative.structure}`,
    );
  }
  if (matched.visual?.length) {
    const v = Object.values(film.visualStyle).filter(Boolean).slice(0, 2);
    if (v.length) why.push(`Visual language: ${v.join("; ")}`);
  }
  if (interp.avoid.includes("jump scares") && film.jumpScares === "none") {
    why.push("No reliance on jump scares");
  }
  if (interp.preferObscure && (m.popularity === "obscure" || m.popularity === "cult")) {
    why.push(`Off the beaten path (${m.popularity})`);
  }
  return why.slice(0, 5);
}

export function rankFilms(
  dimensionResults: DimensionResult[],
  films: Film[],
  interp: QueryInterpretation,
): FilmScore[] {
  const byId = new Map(films.map((f) => [f.id, f]));
  const active = dimensionResults.filter((d) => d.active);

  // Per-dimension normalized film → score maps
  const dimMaps = new Map<Dimension, Map<string, number>>();
  for (const d of active) dimMaps.set(d.dimension, normalizeScores(d.hits));

  const scores = new Map<string, FilmScore>();

  for (const film of films) {
    let weighted = 0;
    let weightSum = 0;
    const dimensionScores: Partial<Record<Dimension, number>> = {};
    const matchedTerms: Partial<Record<Dimension, string[]>> = {};

    for (const d of active) {
      const w = DIMENSION_WEIGHT[d.dimension];
      const s = dimMaps.get(d.dimension)?.get(film.id) ?? 0;
      weighted += w * s;
      weightSum += w;
      if (s > 0) {
        dimensionScores[d.dimension] = s;
        const terms = matchedTermsFor(d.hits, film.id);
        if (terms.length) matchedTerms[d.dimension] = terms;
      }
    }

    let score = weightSum > 0 ? weighted / weightSum : 0;

    // Avoid penalties
    if (interp.avoid.includes("jump scares")) {
      score -= JUMP_SCARE_PENALTY[film.jumpScares] ?? 0;
    }
    if (interp.avoid.includes("gore") || interp.avoid.includes("gory")) {
      const gory = film.techniques.some((t) => /gore|blood/i.test(t));
      if (gory) score -= 0.25;
    }
    if (interp.avoid.includes("slow") && /slow|deliberate|meditative/i.test(film.narrative.pacing)) {
      score -= 0.3;
    }

    // Popularity nudges
    const rank = POPULARITY_RANK[film.metadata.popularity] ?? 2;
    if (interp.preferObscure) score += (3 - rank) * 0.05;
    if (interp.preferPopular) score += rank * 0.04;

    // Explicit genre match is a strong signal when stated
    if (interp.genres.length) {
      const filmGenres = film.metadata.genres.map((g) => g.toLowerCase());
      const hit = interp.genres.some((g) =>
        filmGenres.some((fg) => fg.includes(g) || g.includes(fg)),
      );
      score += hit ? 0.15 : -0.1;
    }

    if (score <= 0) continue;

    const clamped = Math.max(0, Math.min(1, score));
    scores.set(film.id, {
      film: byId.get(film.id)!,
      score: clamped,
      displayScore: Math.round(40 + clamped * 55), // 40–95 range reads honestly
      dimensionScores,
      matchedTerms,
      why: [],
    });
  }

  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
  for (const s of ranked) {
    s.why = buildWhy(s.film, interp, s.matchedTerms);
  }
  return ranked.slice(0, 8);
}
