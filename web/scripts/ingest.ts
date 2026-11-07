// Validates the curated film corpus and reports corpus statistics.
//
//   npm run ingest              validate + stats (local JSON store)
//   npm run ingest -- --embed   also compute/cache embeddings (needs key)
//   npm run ingest -- --store=firebase   upload to Firestore (when implemented)
//
// Validation exists because this corpus is the ground truth for the
// whole experiment — a malformed analysis field silently degrades
// every pipeline that retrieves from it.

import { loadEnv } from "./env";
loadEnv();

import { getFilmRepository } from "@/lib/data";
import { buildCorpus } from "@/lib/retrieval/chunks";
import { DIMENSIONS, type Film } from "@/lib/types";

const REQUIRED_ARRAY_FIELDS: (keyof Film)[] = [
  "themes",
  "atmosphere",
  "techniques",
];

function validate(film: Film): string[] {
  const issues: string[] = [];
  const m = film.metadata ?? ({} as Film["metadata"]);
  if (!film.id) issues.push("missing id");
  if (!m.title) issues.push("missing metadata.title");
  if (!m.year) issues.push("missing metadata.year");
  if (!m.director) issues.push("missing metadata.director");
  if (!Array.isArray(m.genres) || !m.genres.length)
    issues.push("metadata.genres empty");
  if (!["popular", "acclaimed", "cult", "obscure"].includes(m.popularity))
    issues.push(`bad popularity: ${m.popularity}`);
  if (!["none", "minimal", "moderate", "heavy"].includes(film.jumpScares))
    issues.push(`bad jumpScares: ${film.jumpScares}`);
  for (const f of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(film[f]) || !(film[f] as string[]).length)
      issues.push(`${String(f)} empty`);
  }
  for (const k of ["pacing", "structure", "storytelling", "dialogue"] as const) {
    if (!film.narrative?.[k]) issues.push(`narrative.${k} missing`);
  }
  for (const d of DIMENSIONS) {
    if (!film.analysis?.[d] || film.analysis[d].length < 20)
      issues.push(`analysis.${d} missing or too short`);
  }
  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const films = await getFilmRepository().listFilms();

  let bad = 0;
  for (const f of films) {
    const issues = validate(f);
    if (issues.length) {
      bad++;
      console.error(`✗ ${f.id ?? "(no id)"}: ${issues.join("; ")}`);
    }
  }
  console.log(`\n${films.length} films, ${bad} invalid`);
  if (bad) process.exit(1);

  const chunks = buildCorpus(films);
  const byDim = new Map<string, number>();
  for (const c of chunks) byDim.set(c.dimension, (byDim.get(c.dimension) ?? 0) + 1);
  console.log(`${chunks.length} chunks:`, Object.fromEntries(byDim));

  const pop = new Map<string, number>();
  for (const f of films)
    pop.set(f.metadata.popularity, (pop.get(f.metadata.popularity) ?? 0) + 1);
  console.log("popularity tiers:", Object.fromEntries(pop));

  if (args.includes("--embed")) {
    const { EmbeddingRetriever } = await import(
      "@/lib/retrieval/embedding"
    );
    if (!process.env.OPENAI_API_KEY) {
      console.error("--embed requires OPENAI_API_KEY");
      process.exit(1);
    }
    const r = new EmbeddingRetriever(chunks);
    await r.search("warmup", { k: 1 }); // triggers embedding + cache write
    console.log("embeddings cached to data/indexed/embeddings.json");
  }

  if (args.includes("--store=firebase")) {
    console.log(
      "\nFirestore upload not implemented yet — see src/lib/data/firestore.ts\n" +
        "for the planned document mapping (films/{id} ↔ Film type, 1:1).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
