import { NextRequest, NextResponse } from "next/server";
import { getFilmRepository } from "@/lib/data";
import { buildAgentContext, runSearch } from "@/lib/pipelines";
import { PIPELINE_MODES, type PipelineMode } from "@/lib/types";

// GET /api/search?q=...&mode=multi
// Programmatic access to all four comparison systems — used by the UI
// and available for the eval harness / external tooling.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const rawMode = req.nextUrl.searchParams.get("mode") ?? "multi";
  const mode = (PIPELINE_MODES as string[]).includes(rawMode)
    ? (rawMode as PipelineMode)
    : "multi";

  if (!q.trim()) {
    return NextResponse.json({ error: "missing q parameter" }, { status: 400 });
  }

  const films = await getFilmRepository().listFilms();
  const ctx = await buildAgentContext(films);
  const result = await runSearch(q, mode, ctx);
  return NextResponse.json(result);
}
