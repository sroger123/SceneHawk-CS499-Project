import type { CompleteOptions, LLMClient } from "./client";

// Mock LLM — lets every pipeline run end-to-end with no API key.
// It never fabricates: components detect isMock and fall back to their
// deterministic heuristic/template paths, so results stay honest and
// reproducible for the baseline experiments.
export class MockLLM implements LLMClient {
  name = "mock";
  isMock = true;

  async complete(_prompt: string, _opts: CompleteOptions = {}): Promise<string> {
    return "";
  }
}
