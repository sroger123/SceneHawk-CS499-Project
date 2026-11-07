import { NextRequest, NextResponse } from "next/server";
import { getFilmRepository } from "@/lib/data";
import { buildAgentContext } from "@/lib/pipelines";
import { getLLM } from "@/lib/llm";
import { buildChunks } from "@/lib/retrieval/chunks";
import type { Dimension } from "@/lib/types";

// POST /api/films/:id/ask { question }
// Single-film RAG: retrieves the most relevant analytical chunks for
// the film and answers grounded in them (LLM when configured,
// template otherwise — never fabricated).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  const repo = getFilmRepository();
  const [film, catalog] = await Promise.all([
    repo.getFilm(id),
    repo.listFilms(),
  ]);
  if (!film) {
    return NextResponse.json({ error: "film not found" }, { status: 404 });
  }

  const ctx = await buildAgentContext(catalog);
  const filmChunks = buildChunks(film);

  // Retrieve the dimension whose analysis best matches the question.
  // (Per-film chunks are few, so we search the corpus then intersect —
  // keeps behavior identical between BM25 and embedding retrievers.)
  const hits = await ctx.retriever.search(question, { k: 12 });
  const filmHit = hits.find((h) => h.chunk.filmId === film.id);
  const dimension: Dimension =
    filmHit && filmHit.chunk.dimension !== "metadata"
      ? (filmHit.chunk.dimension as Dimension)
      : "atmosphere";

  const llm = getLLM();
  const evidence = filmChunks.find((c) => c.dimension === dimension);
  const analysisText = film.analysis[dimension];

  if (llm.isMock) {
    // Template answer — quotes the grounded analysis verbatim.
    return NextResponse.json({
      answer: analysisText,
      source: "template",
      dimension,
    });
  }

  try {
    const answer = await llm.complete(
      `Film: ${film.metadata.title} (${film.metadata.year})\n` +
        `Relevant ${dimension} analysis: ${analysisText}\n` +
        (evidence ? `Supporting chunk: ${evidence.text}\n` : "") +
        `\nQuestion: ${question}\n` +
        "Answer in 2-4 sentences using ONLY the provided analysis. If the analysis doesn't address the question, say so plainly.",
      {
        system:
          "You answer questions about a film using only the supplied analytical evidence. Never invent plot details.",
        temperature: 0.3,
      },
    );
    return NextResponse.json({ answer, source: "llm", dimension });
  } catch {
    return NextResponse.json({
      answer: analysisText,
      source: "template",
      dimension,
    });
  }
}
