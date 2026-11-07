import type { Chunk, Dimension, Film } from "@/lib/types";

// Builds the analytical corpus: one metadata chunk + one chunk per
// analytical dimension per film. The structured fields and the prose
// analysis are flattened into retrievable text.
//
// When you move to Firestore + embeddings, keep this function — it defines
// *what* gets indexed regardless of where the films live.
export function buildChunks(film: Film): Chunk[] {
  const m = film.metadata;
  const chunks: Chunk[] = [
    {
      id: `${film.id}:metadata`,
      filmId: film.id,
      dimension: "metadata",
      text: [
        m.title,
        String(m.year),
        m.director,
        m.genres.join(" "),
        `popularity ${m.popularity}`,
      ].join("\n"),
    },
  ];

  const byDimension: Record<Dimension, string> = {
    themes: [
      film.themes.join(" "),
      (film.symbols ?? []).join(" "),
      film.analysis.themes,
    ].join("\n"),
    atmosphere: [film.atmosphere.join(" "), film.analysis.atmosphere].join(
      "\n",
    ),
    narrative: [
      film.narrative.pacing,
      film.narrative.structure,
      film.narrative.storytelling,
      film.narrative.dialogue,
      film.analysis.narrative,
    ].join("\n"),
    visual: [
      ...Object.values(film.visualStyle).filter(Boolean),
      film.techniques.join(" "),
      film.analysis.visual,
    ].join("\n"),
    characters: film.analysis.characters,
  };

  for (const [dimension, text] of Object.entries(byDimension) as [
    Dimension,
    string,
  ][]) {
    chunks.push({
      id: `${film.id}:${dimension}`,
      filmId: film.id,
      dimension,
      text,
    });
  }

  return chunks;
}

export function buildCorpus(films: Film[]): Chunk[] {
  return films.flatMap(buildChunks);
}
