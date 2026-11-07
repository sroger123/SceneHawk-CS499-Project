import { promises as fs } from "fs";
import path from "path";
import { config } from "@/lib/config";
import type {
  Chunk,
  Dimension,
  Retriever,
  ScoredChunk,
} from "@/lib/types";

const CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "indexed",
  "embeddings.json",
);

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// Embedding-based retriever. Requires OPENAI_API_KEY; embeddings are
// cached to data/indexed/embeddings.json so re-indexing isn't needed
// on every run (invalidate by deleting that file after changing data).
export class EmbeddingRetriever implements Retriever {
  name = "openai-embeddings";

  private chunks: Chunk[] = [];
  private ready: Promise<void>;

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    let cached: Record<string, number[]> = {};
    try {
      cached = JSON.parse(await fs.readFile(CACHE_PATH, "utf8"));
    } catch {
      // no cache yet — will compute below
    }

    const missing = this.chunks.filter((c) => !cached[c.id]);
    if (missing.length > 0) {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: config.openaiApiKey });
      // Batch in groups of 100 to stay under token limits.
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100);
        const res = await client.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: batch.map((c) => c.text),
        });
        batch.forEach((c, j) => {
          cached[c.id] = res.data[j].embedding;
        });
      }
      // Best-effort: serverless filesystems (e.g. Vercel) are read-only
      // outside /tmp, so a failed write just means no cache this run.
      try {
        await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
        await fs.writeFile(CACHE_PATH, JSON.stringify(cached));
      } catch (err) {
        console.warn("embedding cache not written:", (err as Error).message);
      }
    }

    for (const c of this.chunks) c.embedding = cached[c.id];
  }

  private async embed(text: string): Promise<number[]> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const res = await client.embeddings.create({
      model: config.openaiEmbeddingModel,
      input: text,
    });
    return res.data[0].embedding;
  }

  async search(
    query: string,
    opts: { dimension?: Dimension | "metadata"; k?: number } = {},
  ): Promise<ScoredChunk[]> {
    await this.ready;
    const q = await this.embed(query);
    const k = opts.k ?? 12;

    return this.chunks
      .filter(
        (c) =>
          c.embedding && (!opts.dimension || c.dimension === opts.dimension),
      )
      .map((c) => ({
        chunk: c,
        score: cosine(q, c.embedding!),
        matchedTerms: [],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
