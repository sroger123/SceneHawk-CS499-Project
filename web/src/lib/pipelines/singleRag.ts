import type {
  AgentContext,
  DimensionResult,
  FilmScore,
  QueryInterpretation,
} from "@/lib/types";
import { rankFilms } from "@/lib/agents/ranker";

// ─── System C: single-agent RAG ─────────────────────────────────
//
// One retrieval pass: the interpreted query (flattened into a single
// query string) is run against the WHOLE analytical corpus with no
// dimension specialization. Same ranker/explainer as the multi-agent
// pipeline — the only difference is that retrieval isn't decomposed.
//
// This is the key ablation: if multi-agent beats this, the improvement
// is attributable to specialization, not just to RAG itself.

export async function runSingleRAG(
  interp: QueryInterpretation,
  ctx: AgentContext,
): Promise<FilmScore[]> {
  // Flatten all interpreted criteria into one undifferentiated query.
  const query = [
    ...interp.themes,
    ...interp.mood,
    ...interp.pacing,
    ...interp.narrative,
    ...interp.visual,
    ...interp.genres,
    interp.raw, // raw text carries nuance the fields may miss
  ].join(" ");

  const hits = await ctx.retriever.search(query, { k: 24 });

  // Wrap the flat hits as a pseudo single "dimension" so the shared
  // ranker can consume them. We split hits back into their own
  // dimensions to keep matchedTerms/dimensionScores honest.
  const byDim = new Map<string, typeof hits>();
  for (const h of hits) {
    if (h.chunk.dimension === "metadata") continue; // not a scored dimension
    const list = byDim.get(h.chunk.dimension) ?? [];
    list.push(h);
    byDim.set(h.chunk.dimension, list);
  }

  const dimensionResults: DimensionResult[] = [...byDim.entries()].map(
    ([dim, dimHits]) => ({
      dimension: dim as DimensionResult["dimension"],
      query,
      hits: dimHits,
      active: true,
    }),
  );

  return rankFilms(dimensionResults, ctx.films, interp);
}
