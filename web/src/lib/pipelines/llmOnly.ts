import type { LLMClient } from "@/lib/llm/client";
import type { AgentContext, FilmScore } from "@/lib/types";

// ─── System B: LLM-only baseline ────────────────────────────────
//
// The raw query goes straight to the LLM along with the catalog's
// titles — no retrieval, no analytical corpus, no interpretation step.
// Whatever the model "knows" is all it can use. With no API key, this
// returns an empty result with an honest note (a mock LLM inventing
// recommendations would poison the experiment).

const SYSTEM = `You are a film recommendation engine. You may ONLY recommend titles from the provided catalog. Reply with JSON: {"picks":[{"id":"<catalog id>","reason":"<one sentence>"}]}, ordered best-first. Base choices on what you know of the films.`;

export async function runLLMOnly(
  query: string,
  ctx: AgentContext,
  llm: LLMClient,
): Promise<{ results: FilmScore[]; note?: string }> {
  if (llm.isMock) {
    return {
      results: [],
      note: "LLM-only mode requires OPENAI_API_KEY — a mock model would just be guessing, which would invalidate the comparison.",
    };
  }

  const catalog = ctx.films
    .map(
      (f) =>
        `${f.id} | ${f.metadata.title} (${f.metadata.year}) dir. ${f.metadata.director} | ${f.metadata.genres.join("/")}`,
    )
    .join("\n");

  try {
    const raw = await llm.complete(
      `Catalog:\n${catalog}\n\nUser request: "${query}"`,
      { system: SYSTEM, json: true, temperature: 0.5 },
    );
    const parsed = JSON.parse(raw) as {
      picks?: { id: string; reason?: string }[];
    };
    const byId = new Map(ctx.films.map((f) => [f.id, f]));

    const results: FilmScore[] = [];
    for (const [i, pick] of (parsed.picks ?? []).entries()) {
      const film = byId.get(pick.id);
      if (!film) continue;
      const score = Math.max(0.2, 1 - i * 0.12);
      results.push({
        film,
        score,
        displayScore: Math.round(45 + score * 45),
        dimensionScores: {},
        matchedTerms: {},
        why: pick.reason ? [pick.reason] : ["LLM selection"],
        explanation: pick.reason,
      });
    }
    return { results: results.slice(0, 8) };
  } catch {
    return {
      results: [],
      note: "LLM-only call failed — check OPENAI_API_KEY/model.",
    };
  }
}
