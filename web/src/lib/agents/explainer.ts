import type { LLMClient } from "@/lib/llm/client";
import type { FilmScore, QueryInterpretation } from "@/lib/types";

// ─── Agent 5b: Explanation ──────────────────────────────────────
//
// Produces the "why it matches" narrative per recommended film.
// With an LLM key it writes grounded prose from the matched evidence;
// without one it renders the deterministic `why` bullets (which are
// already honest — they cite the actual matched attributes).

const EXPLAIN_SYSTEM = `You are the explanation agent of a film-discovery system. Given a user's request and structured evidence about why a film was retrieved, write 2-3 sentences explaining the match. Rules: cite only the provided evidence (themes, atmosphere, narrative, visual style, techniques). Never invent plot details or attributes. No spoilers. Plain, direct prose.`;

function templateExplanation(score: FilmScore): string {
  return score.why.join(". ") + ".";
}

export async function explainRecommendations(
  results: FilmScore[],
  interp: QueryInterpretation,
  llm: LLMClient,
): Promise<FilmScore[]> {
  if (llm.isMock) {
    for (const r of results) r.explanation = templateExplanation(r);
    return results;
  }

  for (const r of results) {
    try {
      const evidence = [
        `Title: ${r.film.metadata.title} (${r.film.metadata.year}), dir. ${r.film.metadata.director}`,
        `Themes: ${r.film.themes.join(", ")}`,
        `Atmosphere: ${r.film.atmosphere.join(", ")}`,
        `Narrative: ${r.film.narrative.pacing} pacing; ${r.film.narrative.structure}; ${r.film.narrative.storytelling}`,
        `Visual: ${Object.values(r.film.visualStyle).filter(Boolean).join("; ")}`,
        `Techniques: ${r.film.techniques.join(", ")}`,
        `Matched dimensions: ${Object.keys(r.dimensionScores).join(", ")}`,
      ].join("\n");
      r.explanation = await llm.complete(
        `User request: "${interp.raw}"\n\nEvidence:\n${evidence}`,
        { system: EXPLAIN_SYSTEM, temperature: 0.4 },
      );
    } catch {
      r.explanation = templateExplanation(r);
    }
  }
  return results;
}
