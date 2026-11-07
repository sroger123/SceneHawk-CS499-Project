import { readPrompt, type ReadPrompt } from "./promptReader";

// The query half of the pipeline: read the prompt, then ask Supabase's
// match_films() to filter by genre, match the feelings table and the
// description table, and combine the scores. The trained model is not called
// here: it already ran offline and its output is the feelings table.

export interface FeelingMatch {
  tmdbId: number;
  title: string;
  year: number | null;
  genres: string[];
  overview: string | null;
  rating: number | null;
  reviewCount: number;
  feelingScore: number;
  storyScore: number;
  score: number;
  feelings: Record<string, number>;
  evidence: string | null;
  evidenceFeeling: string | null;
  lowConfidence: boolean;
  genreRelaxed: boolean;
  modelVersion: string | null;
}

export interface FeelingSearch {
  read: ReadPrompt;
  films: FeelingMatch[];
}

interface Row {
  tmdb_id: number;
  title: string;
  year: number | null;
  genres: string[] | null;
  overview: string | null;
  vote_average: number | null;
  review_count: number;
  feeling_score: number;
  story_score: number;
  score: number;
  feelings: Record<string, number> | null;
  evidence: string | null;
  evidence_feeling: string | null;
  low_confidence: boolean;
  genre_relaxed: boolean;
  model_version: string | null;
}

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function rpc<T>(fn: string, body: object): Promise<T> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase is not configured");
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase ${fn} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function searchByFeeling(
  message: string,
  k = 6,
): Promise<FeelingSearch> {
  const read = readPrompt(message);
  const rows = await rpc<Row[]>("match_films", {
    p_feelings: read.feelings,
    p_avoid: read.avoid,
    p_story_terms: read.storyTerms,
    p_genres: read.genres,
    p_not_genres: read.notGenres,
    p_feeling_weight: read.feelingWeight,
    p_k: k,
  });
  return {
    read,
    films: rows.map((r) => ({
      tmdbId: r.tmdb_id,
      title: r.title,
      year: r.year,
      genres: r.genres ?? [],
      overview: r.overview,
      rating: r.vote_average,
      reviewCount: r.review_count,
      feelingScore: r.feeling_score,
      storyScore: r.story_score,
      score: r.score,
      feelings: r.feelings ?? {},
      evidence: r.evidence,
      evidenceFeeling: r.evidence_feeling,
      lowConfidence: r.low_confidence,
      genreRelaxed: r.genre_relaxed,
      modelVersion: r.model_version,
    })),
  };
}

export async function searchStatus() {
  const rows = await rpc<
    { films: number; films_with_feelings: number; model_version: string | null }[]
  >("search_status", {});
  return rows[0];
}

const list = (xs: string[]) =>
  xs.length <= 1
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** A plain written answer built only from what the search returned. */
export function writeReply({ read, films }: FeelingSearch): string {
  if (films.length === 0) {
    return "No films matched. Try describing the mood (tense, cozy, sad…) or the story in other words.";
  }

  const asked: string[] = [];
  if (read.feelings.length) asked.push(`feel ${list(read.feelings)}`);
  if (read.storyTerms.length) asked.push(`have a story about “${read.storyTerms.join(" ")}”`);
  if (read.genres.length) asked.push(`are ${list(read.genres)}`);
  const avoid = [...read.avoid, ...read.notGenres];

  const lines: string[] = [];
  lines.push(
    asked.length
      ? `Films that ${list(asked)}${avoid.length ? `, avoiding ${list(avoid)}` : ""}:`
      : "Here are some films to start with:",
  );
  if (films[0]?.genreRelaxed) {
    lines.push("(Too few films had that genre, so the genre filter was loosened.)");
  }
  lines.push("");

  for (const f of films.slice(0, 3)) {
    const why: string[] = [];
    const top = Object.entries(f.feelings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name, s]) => `${name} ${s.toFixed(2)}`);
    if (read.feelings.length && top.length) why.push(`feeling scores: ${top.join(", ")}`);
    if (read.storyTerms.length && f.storyScore > 0) why.push("its description matches your story words");
    const conf = f.lowConfidence
      ? ` Based on only ${f.reviewCount} review${f.reviewCount === 1 ? "" : "s"}, so low confidence.`
      : "";
    lines.push(
      `• ${f.title}${f.year ? ` (${f.year})` : ""}${why.length ? `: ${why.join("; ")}.` : "."}${conf}`,
    );
  }

  lines.push("");
  lines.push(
    "Feeling scores are the average our feelings model gave the film's reviews (0 to 1). The model is an early version, so treat them as rough.",
  );
  return lines.join("\n");
}
