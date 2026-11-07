import type {
  AgentContext,
  FilmScore,
  QueryInterpretation,
} from "@/lib/types";
import { runAllDimensionAgents } from "@/lib/agents/dimensionAgents";
import { rankFilms } from "@/lib/agents/ranker";
import { runSingleRAG } from "./singleRag";

// ─── System D: multi-agent RAG ──────────────────────────────────
//
// The full proposed architecture:
//   interpretation → specialized agents (theme / mood / narrative /
//   visual) each retrieve within their own chunk space → ranker
//   aggregates weighted evidence → explainer justifies picks.
//
// The hypothesis under test: decomposing retrieval by cinematic
// dimension produces better matches for experience-driven queries
// than a single undifferentiated retrieval pass.

export async function runMultiRAG(
  interp: QueryInterpretation,
  ctx: AgentContext,
): Promise<FilmScore[]> {
  const dimensionResults = await runAllDimensionAgents(interp, ctx);

  // If the interpretation produced no dimension-specific criteria
  // (e.g. a vague query like "something good"), degrade to a flat
  // retrieval pass on the raw text rather than returning nothing.
  if (!dimensionResults.some((d) => d.active)) {
    return runSingleRAG(interp, ctx);
  }

  return rankFilms(dimensionResults, ctx.films, interp);
}
