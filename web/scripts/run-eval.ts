// Evaluation harness — runs every query in eval/queries.json through
// all four systems and writes eval/results-<timestamp>.json for human
// rating, plus a compact terminal table.
//
//   npm run eval                 run all queries × all systems
//   npm run eval -- --q=q03      run one query
//   npm run eval -- --mode=multi run one system
//
// The output JSON leaves `ratings` slots blank — fill them in during
// human evaluation (relevance/diversity/explanation/grounding, 1–5).

import { loadEnv } from "./env";
loadEnv();

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { getFilmRepository } from "@/lib/data";
import { buildAgentContext, runSearch } from "@/lib/pipelines";
import { PIPELINE_MODES, type PipelineMode } from "@/lib/types";

interface EvalQuery {
  id: string;
  category: string;
  query: string;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyQ = args.find((a) => a.startsWith("--q="))?.slice(4);
  const onlyMode = args
    .find((a) => a.startsWith("--mode="))
    ?.slice(7) as PipelineMode | undefined;

  const queries = (
    JSON.parse(
      readFileSync(path.join(process.cwd(), "eval", "queries.json"), "utf8"),
    ) as EvalQuery[]
  ).filter((q) => !onlyQ || q.id === onlyQ);

  const modes = onlyMode ? [onlyMode] : PIPELINE_MODES;

  const films = await getFilmRepository().listFilms();
  const ctx = await buildAgentContext(films);
  console.log(
    `corpus: ${films.length} films · retriever: ${ctx.retriever.name}\n`,
  );

  const output: Record<string, unknown>[] = [];

  for (const q of queries) {
    console.log(`${q.id} [${q.category}] "${q.query}"`);
    const record: Record<string, unknown> = {
      id: q.id,
      category: q.category,
      query: q.query,
      systems: {} as Record<string, unknown>,
      ratings: {}, // filled during human evaluation
    };
    const systems = record.systems as Record<string, unknown>;

    for (const mode of modes) {
      const result = await runSearch(q.query, mode, ctx);
      systems[mode] = {
        interpretation: result.interpretation,
        note: result.note ?? null,
        results: result.results.map((r) => ({
          filmId: r.film.id,
          title: r.film.metadata.title,
          displayScore: r.displayScore,
          dimensions: Object.keys(r.dimensionScores),
          why: r.why,
        })),
      };
      const top3 = result.results
        .slice(0, 3)
        .map((r) => r.film.metadata.title)
        .join(" | ");
      console.log(`  ${mode.padEnd(8)} → ${top3 || "(no results)"}`);
    }
    output.push(record);
    console.log();
  }

  mkdirSync(path.join(process.cwd(), "eval"), { recursive: true });
  const outPath = path.join(
    process.cwd(),
    "eval",
    `results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`wrote ${outPath}`);
  console.log(
    `\nNext step: rate each system's output on relevance, diversity,\n` +
      `explanation quality, and grounding (1–5) in the results file.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
