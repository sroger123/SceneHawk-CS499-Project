import type {
  AgentContext,
  Film,
  PipelineMode,
  SearchResult,
} from "@/lib/types";
import { getLLM } from "@/lib/llm";
import { getRetriever } from "@/lib/retrieval";
import { interpretQuery } from "@/lib/agents/interpreter";
import { explainRecommendations } from "@/lib/agents/explainer";
import { runContentBased } from "./contentBased";
import { runLLMOnly } from "./llmOnly";
import { runSingleRAG } from "./singleRag";
import { runMultiRAG } from "./multiRag";

// Runs one of the four comparison systems end-to-end and returns a
// normalized SearchResult. This is the single entry point used by the
// search page, /api/search, and the eval harness — the comparison stays
// honest because every consumer goes through the same code path.

export async function runSearch(
  query: string,
  mode: PipelineMode,
  ctx: AgentContext,
): Promise<SearchResult> {
  const llm = getLLM();
  const interpretation = await interpretQuery(query, llm);

  let results: SearchResult["results"] = [];
  let note: string | undefined;

  switch (mode) {
    case "content":
      results = runContentBased(interpretation, ctx);
      break;
    case "llm": {
      const out = await runLLMOnly(query, ctx, llm);
      results = out.results;
      note = out.note;
      break;
    }
    case "rag":
      results = await runSingleRAG(interpretation, ctx);
      break;
    case "multi":
      results = await runMultiRAG(interpretation, ctx);
      break;
  }

  if (mode !== "llm") {
    results = await explainRecommendations(results, interpretation, llm);
  }

  if (llm.isMock && mode !== "llm") {
    note =
      "Running on local providers (heuristic interpretation, template explanations). Set OPENAI_API_KEY to enable the LLM-backed agents.";
  }

  return { mode, query, interpretation, results, note };
}

export async function buildAgentContext(films: Film[]): Promise<AgentContext> {
  return { films, retriever: await getRetriever(films) };
}
