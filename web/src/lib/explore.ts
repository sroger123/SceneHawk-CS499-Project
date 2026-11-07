import type { Dimension, Film, FilmConnection } from "@/lib/types";

// ─── Film-to-film exploration ───────────────────────────────────
//
// Instead of "movies similar to this one," connections are computed
// per analytical dimension — so the UI can say things like "shares its
// atmosphere but tells the story completely differently."

function termSet(film: Film, dim: Dimension): Set<string> {
  const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
  switch (dim) {
    case "themes":
      return new Set([...lower(film.themes), ...lower(film.symbols ?? [])]);
    case "atmosphere":
      return new Set(lower(film.atmosphere));
    case "narrative":
      return new Set(
        lower([
          film.narrative.pacing,
          film.narrative.storytelling,
          ...film.narrative.structure.split(/[,\s]+/),
        ]),
      );
    case "visual":
      return new Set(
        lower([
          ...Object.values(film.visualStyle).filter(
            (v): v is string => !!v,
          ),
          ...film.techniques,
        ]).values(),
      );
    case "characters":
      return new Set(lower(film.themes)); // proxy — character prose isn't taggable
  }
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const RELATION_LABEL: Record<Dimension, string> = {
  themes: "Similar thematic territory",
  atmosphere: "Feels the same — shared atmosphere",
  narrative: "Tells its story the same way",
  visual: "Speaks a similar visual language",
  characters: "Comparable inner lives",
};

export function exploreConnections(
  film: Film,
  catalog: Film[],
  limit = 3,
): FilmConnection[] {
  const candidates = catalog.filter((f) => f.id !== film.id);
  const dims: Dimension[] = ["themes", "atmosphere", "narrative", "visual"];

  // Per-dimension similarity table
  const sims = candidates.map((other) => {
    const byDim = new Map<Dimension, number>();
    for (const d of dims) {
      byDim.set(d, jaccard(termSet(film, d), termSet(other, d)));
    }
    return { other, byDim };
  });

  const picked: FilmConnection[] = [];
  const used = new Set<string>();

  // For each dimension, pick the strongest unseen connection
  for (const dim of dims) {
    const best = sims
      .filter((s) => !used.has(s.other.id))
      .sort((a, b) => (b.byDim.get(dim) ?? 0) - (a.byDim.get(dim) ?? 0))[0];
    const score = best?.byDim.get(dim) ?? 0;
    if (best && score > 0) {
      used.add(best.other.id);
      picked.push({
        film: best.other,
        relation: RELATION_LABEL[dim],
        sharedDimensions: [dim],
        score,
      });
    }
  }

  // One "contrast" pick: high atmosphere similarity, low narrative —
  // "isolated like this film, but achieved through different means."
  const contrast = sims
    .filter((s) => !used.has(s.other.id))
    .map((s) => ({
      s,
      val:
        (s.byDim.get("atmosphere") ?? 0) - (s.byDim.get("narrative") ?? 0),
    }))
    .sort((a, b) => b.val - a.val)[0];
  if (contrast && contrast.val > 0.05) {
    picked.push({
      film: contrast.s.other,
      relation: "Similar feeling, different storytelling",
      sharedDimensions: ["atmosphere"],
      score: contrast.val,
    });
  }

  return picked.slice(0, limit);
}
