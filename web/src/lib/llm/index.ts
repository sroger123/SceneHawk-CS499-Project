import { config } from "@/lib/config";
import type { LLMClient } from "./client";
import { OpenAIClient } from "./openai";
import { MockLLM } from "./mock";

let client: LLMClient | null = null;

export function getLLM(): LLMClient {
  if (client) return client;
  client = config.hasOpenAI ? new OpenAIClient() : new MockLLM();
  return client;
}
