import { config } from "@/lib/config";
import type { Film, Retriever } from "@/lib/types";
import { buildCorpus } from "./chunks";
import { BM25Retriever } from "./bm25";
import { EmbeddingRetriever } from "./embedding";

let cached: Retriever | null = null;

export async function getRetriever(films: Film[]): Promise<Retriever> {
  if (cached) return cached;
  const chunks = buildCorpus(films);
  cached =
    config.retriever === "embedding" && config.hasOpenAI
      ? new EmbeddingRetriever(chunks)
      : new BM25Retriever(chunks);
  return cached;
}
