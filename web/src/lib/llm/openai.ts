import { config } from "@/lib/config";
import type { CompleteOptions, LLMClient } from "./client";

export class OpenAIClient implements LLMClient {
  name = "openai";
  isMock = false;

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    // Dynamic import keeps `openai` out of the bundle unless actually used.
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const res = await client.chat.completions.create({
      model: config.openaiModel,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        ...(opts.system
          ? [{ role: "system" as const, content: opts.system }]
          : []),
        { role: "user" as const, content: prompt },
      ],
    });

    return res.choices[0]?.message?.content ?? "";
  }
}
