import type {
  AgentContext,
  Dimension,
  DimensionResult,
  QueryInterpretation,
} from "@/lib/types";

// ─── Agents 2–4: specialized retrieval agents ───────────────────
//
// Each agent owns one analytical dimension. It (a) decides whether the
// interpreted query concerns its dimension, (b) constructs a specialized
// query from the relevant criteria, and (c) retrieves evidence only from
// chunks of its own dimension. The ranker then aggregates across agents —
// this specialization is the hypothesis under test vs single-agent RAG.

interface DimensionSpec {
  dimension: Dimension;
  // Which interpretation fields feed this agent's query.
  fields: (i: QueryInterpretation) => string[];
  // Which chunk dimension(s) it searches.
  chunkDimension: Dimension;
}

const SPECS: DimensionSpec[] = [
  {
    dimension: "themes",
    fields: (i) => [...i.themes, ...i.genres],
    chunkDimension: "themes",
  },
  {
    dimension: "atmosphere",
    fields: (i) => i.mood,
    chunkDimension: "atmosphere",
  },
  {
    dimension: "narrative",
    fields: (i) => [...i.pacing, ...i.narrative],
    chunkDimension: "narrative",
  },
  {
    dimension: "visual",
    fields: (i) => i.visual,
    chunkDimension: "visual",
  },
];

async function runAgent(
  spec: DimensionSpec,
  interp: QueryInterpretation,
  ctx: AgentContext,
): Promise<DimensionResult> {
  const terms = spec.fields(interp);
  const query = terms.join(" ");
  if (!query.trim()) {
    return { dimension: spec.dimension, query: "", hits: [], active: false };
  }
  const hits = await ctx.retriever.search(query, {
    dimension: spec.chunkDimension,
    k: 10,
  });
  return { dimension: spec.dimension, query, hits, active: true };
}

// Convenience wrappers — these are the four named agents of the
// architecture diagram (Theme/Narrative, Mood/Atmosphere, Visual/Style).
export function themeAgent(i: QueryInterpretation, ctx: AgentContext) {
  return runAgent(SPECS[0], i, ctx);
}
export function moodAgent(i: QueryInterpretation, ctx: AgentContext) {
  return runAgent(SPECS[1], i, ctx);
}
export function narrativeAgent(i: QueryInterpretation, ctx: AgentContext) {
  return runAgent(SPECS[2], i, ctx);
}
export function styleAgent(i: QueryInterpretation, ctx: AgentContext) {
  return runAgent(SPECS[3], i, ctx);
}

export async function runAllDimensionAgents(
  interp: QueryInterpretation,
  ctx: AgentContext,
): Promise<DimensionResult[]> {
  return Promise.all([
    themeAgent(interp, ctx),
    moodAgent(interp, ctx),
    narrativeAgent(interp, ctx),
    styleAgent(interp, ctx),
  ]);
}
