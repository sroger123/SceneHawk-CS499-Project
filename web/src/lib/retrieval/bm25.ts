import type {
  Chunk,
  Dimension,
  Retriever,
  ScoredChunk,
} from "@/lib/types";
import { tokenize } from "./text";

// BM25 over the analytical chunks. This is the default retriever:
// zero dependencies, fully deterministic, and good enough to make the
// multi-agent vs single-agent comparison meaningful.
//
// When OPENAI_API_KEY + RETRIEVER=embedding are set, EmbeddingRetriever
// replaces this behind the same `Retriever` interface.
export class BM25Retriever implements Retriever {
  name = "bm25";

  private k1 = 1.5;
  private b = 0.75;
  private docs: { chunk: Chunk; tokens: string[] }[] = [];
  private docFreq = new Map<string, number>();
  private avgLen = 0;

  constructor(chunks: Chunk[]) {
    this.docs = chunks.map((chunk) => ({
      chunk,
      tokens: tokenize(chunk.text),
    }));
    const total = this.docs.reduce((s, d) => s + d.tokens.length, 0);
    this.avgLen = this.docs.length ? total / this.docs.length : 0;
    for (const { tokens } of this.docs) {
      for (const t of new Set(tokens)) {
        this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
      }
    }
  }

  async search(
    query: string,
    opts: { dimension?: Dimension | "metadata"; k?: number } = {},
  ): Promise<ScoredChunk[]> {
    const qTokens = tokenize(query);
    const k = opts.k ?? 12;
    const n = this.docs.length;

    const scored: ScoredChunk[] = [];
    for (const doc of this.docs) {
      if (opts.dimension && doc.chunk.dimension !== opts.dimension) continue;

      const tf = new Map<string, number>();
      for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      const matched: string[] = [];
      for (const qt of new Set(qTokens)) {
        const f = tf.get(qt);
        if (!f) continue;
        const df = this.docFreq.get(qt) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const denom =
          f +
          this.k1 * (1 - this.b + (this.b * doc.tokens.length) / this.avgLen);
        score += idf * ((f * (this.k1 + 1)) / denom);
        matched.push(qt);
      }
      if (score > 0) {
        scored.push({ chunk: doc.chunk, score, matchedTerms: matched });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}
