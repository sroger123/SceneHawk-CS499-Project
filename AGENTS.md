# AGENTS.md — SceneHawk (MATE-CS2148)

Research prototype: multi-agent RAG film discovery. See README.md for the
full architecture and experiment design.

## Commands

- `npm run dev` — dev server (port 3000)
- `npm run build` — production build / typecheck
- `npm run ingest` — validate `data/films/*.json` corpus + stats
- `npm run eval` — run eval queries through all 4 systems
- `npx tsc --noEmit` — typecheck only

## Structure

- `data/films/*.json` — curated corpus (one file per film, `Film` type)
- `src/lib/types.ts` — all domain types, single source of truth
- `src/lib/data/` — `FilmRepository` impls (local JSON now, Firestore stub)
- `src/lib/retrieval/` — chunking + `Retriever` impls (BM25, embeddings)
- `src/lib/agents/` — interpreter, dimension agents, ranker, explainer
- `src/lib/pipelines/` — the 4 comparison systems (`runSearch` = entry point)
- `src/lib/explore.ts` — per-dimension film-to-film connections
- `src/app/` — pages (home, /search, /film/[id]) + API routes
- `eval/queries.json` + `scripts/run-eval.ts` — experiment harness

## Conventions

- Providers are env-swappable: `FILM_STORE`, `RETRIEVER`, `OPENAI_API_KEY`.
  Everything must keep working with **no API key** — LLM-dependent code
  degrades to deterministic heuristic/template fallbacks, never fabricates.
- The four pipelines share `runSearch` — changes to ranking/interpretation
  apply to all systems deliberately (fair comparison).
- Adding a film: create `data/films/<slug>-<year>.json` matching the
  `Film` type, then `npm run ingest` to validate. All five `analysis`
  fields need ≥1 real sentence — they ARE the retrieval corpus.
- "Cinematic Match" scores are retrieval scores — keep the honest labeling.
- UI: design tokens in `src/app/globals.css`, shared primitives in
  `src/components/ui.tsx`, no hard-coded hex colors, and no sign-in/accounts
  (nothing to protect).

## Environment

Copy `.env.example` → `.env.local`. Optional: `OPENAI_API_KEY` enables
LLM interpretation/explanations + `RETRIEVER=embedding`.
