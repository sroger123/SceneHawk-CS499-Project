// Core domain types for the cinematic discovery prototype.
//
// Design principle (per project spec): the knowledge base stores *deep*
// analytical attributes per film — themes, atmosphere, narrative structure,
// visual language, technique — not just conventional metadata. Retrieval
// operates over per-dimension analytical chunks built from these fields.

export type PopularityTier = "popular" | "acclaimed" | "cult" | "obscure";

export type JumpScareLevel = "none" | "minimal" | "moderate" | "heavy";

export type Dimension =
  | "themes"
  | "atmosphere"
  | "narrative"
  | "visual"
  | "characters";

export const DIMENSIONS: Dimension[] = [
  "themes",
  "atmosphere",
  "narrative",
  "visual",
  "characters",
];

export interface FilmMetadata {
  title: string;
  year: number;
  director: string;
  genres: string[];
  runtime?: number;
  popularity: PopularityTier;
  rating?: number;
  tmdbId?: number;
}

export interface NarrativeProfile {
  pacing: string;
  structure: string;
  storytelling: string;
  dialogue: string;
}

export interface VisualStyle {
  lighting?: string;
  camera?: string;
  color?: string;
  aspect?: string;
  composition?: string;
  editing?: string;
}

// Prose analysis per dimension — this is the primary RAG corpus.
// In a production version each of these would carry a `source` field
// (review, essay, annotation) for grounding/evidence.
export interface FilmAnalysis {
  themes: string;
  atmosphere: string;
  narrative: string;
  visual: string;
  characters: string;
}

export interface Film {
  id: string;
  metadata: FilmMetadata;
  themes: string[];
  atmosphere: string[];
  narrative: NarrativeProfile;
  visualStyle: VisualStyle;
  techniques: string[];
  jumpScares: JumpScareLevel;
  symbols?: string[];
  analysis: FilmAnalysis;
}

// ─── Retrieval ──────────────────────────────────────────────────

export interface Chunk {
  id: string; // `${filmId}:${dimension}`
  filmId: string;
  dimension: Dimension | "metadata";
  text: string;
  embedding?: number[];
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  matchedTerms: string[];
}

export interface Retriever {
  name: string;
  search(
    query: string,
    opts?: { dimension?: Dimension | "metadata"; k?: number },
  ): Promise<ScoredChunk[]>;
}

// ─── Query interpretation ───────────────────────────────────────

export interface QueryInterpretation {
  raw: string;
  themes: string[];
  mood: string[]; // atmosphere terms
  pacing: string[];
  narrative: string[];
  visual: string[];
  avoid: string[]; // e.g. "jump scares", "gore"
  genres: string[]; // explicit genre requests
  preferObscure: boolean;
  preferPopular: boolean;
  source: "llm" | "heuristic";
}

export function emptyInterpretation(raw: string): QueryInterpretation {
  return {
    raw,
    themes: [],
    mood: [],
    pacing: [],
    narrative: [],
    visual: [],
    avoid: [],
    genres: [],
    preferObscure: false,
    preferPopular: false,
    source: "heuristic",
  };
}

// ─── Agents ─────────────────────────────────────────────────────

// A dimension agent retrieves evidence within its specialty and reports
// what it found. Same signature for all four so they're composable.
export interface DimensionResult {
  dimension: Dimension;
  query: string; // the specialized query text this agent constructed
  hits: ScoredChunk[];
  active: boolean; // false when the interpretation had nothing for this dimension
}

export interface AgentContext {
  retriever: Retriever;
  films: Film[];
}

// ─── Ranking / results ─────────────────────────────────────────

export interface FilmScore {
  film: Film;
  score: number; // raw 0..1
  displayScore: number; // 0..100 "Cinematic Match" (retrieval score, not validated)
  dimensionScores: Partial<Record<Dimension, number>>;
  matchedTerms: Partial<Record<Dimension, string[]>>;
  why: string[];
  explanation?: string;
}

export type PipelineMode = "content" | "llm" | "rag" | "multi";

export const PIPELINE_MODES: PipelineMode[] = ["content", "llm", "rag", "multi"];

export const PIPELINE_LABELS: Record<PipelineMode, string> = {
  content: "Content-based (baseline)",
  llm: "LLM only",
  rag: "Single-agent RAG",
  multi: "Multi-agent RAG",
};

export interface SearchResult {
  mode: PipelineMode;
  query: string;
  interpretation: QueryInterpretation;
  results: FilmScore[];
  note?: string; // e.g. mock-provider disclaimer
}

// ─── Exploration ────────────────────────────────────────────────

export interface FilmConnection {
  film: Film;
  relation: string; // human-readable connection label
  sharedDimensions: Dimension[];
  score: number;
}
