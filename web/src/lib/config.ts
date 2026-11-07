// Central config — everything provider-related is env-driven so the app
// runs fully offline (heuristic interpreter, template explanations,
// BM25 retrieval) and upgrades to OpenAI when a key is present.

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",

  // "lexical" | "embedding" — embedding falls back to lexical without a key
  retriever: process.env.RETRIEVER ?? "lexical",

  // "local" | "firebase" — firebase adapter is a stub until implemented
  filmStore: process.env.FILM_STORE ?? "local",

  get hasOpenAI(): boolean {
    return this.openaiApiKey.length > 0;
  },
};
