export interface CompleteOptions {
  system?: string;
  json?: boolean; // request JSON-mode output
  temperature?: number;
}

// Minimal LLM interface. Callers are expected to degrade gracefully:
// the interpreter falls back to a lexicon heuristic, the explainer to
// templates — so a MockLLM keeps the whole pipeline runnable.
export interface LLMClient {
  name: string;
  isMock: boolean;
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}
