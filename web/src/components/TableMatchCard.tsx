import { Card, Tag } from "@/components/ui";
import type { FeelingMatch } from "@/lib/feelings/search";

// One result from match_films(): the feelings table (scores from our model)
// and the description table. The score is a retrieval score, not a quality
// rating, so it keeps that label.
export default function TableMatchCard({
  film,
  rank,
}: {
  film: FeelingMatch;
  rank?: number;
}) {
  const feelings = Object.entries(film.feelings).sort((a, b) => b[1] - a[1]);
  const quote = film.evidence?.trim();

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-5">
        {rank !== undefined && (
          <span className="hidden w-6 shrink-0 pt-1 font-display text-lg text-fg-faint sm:block">
            {String(rank).padStart(2, "0")}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words font-display text-xl font-semibold leading-snug sm:text-2xl">
                <a
                  href={`https://www.themoviedb.org/movie/${film.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-accent"
                  title="Open this film on TMDB (new tab)"
                >
                  {film.title}
                </a>
              </h3>
              <p className="mt-1 text-sm text-fg-subtle">
                {film.year ?? "Year unknown"}
                {film.genres.length > 0 && (
                  <span className="text-fg-faint"> · {film.genres.join(", ")}</span>
                )}
              </p>
            </div>

            <div
              className="shrink-0 text-right"
              title="Retrieval score: how well the film's feeling scores and description fit your request. Not a quality rating."
            >
              <div className="font-display text-[28px] leading-none tabular-nums text-accent">
                {Math.round(film.score * 100)}
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
                Match
              </div>
            </div>
          </div>

          {(feelings.length > 0 || film.lowConfidence) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {feelings.map(([name, score]) => (
                <Tag key={name}>
                  {name}
                  <span className="ml-1 tabular-nums text-fg-faint">{score.toFixed(2)}</span>
                </Tag>
              ))}
              {film.lowConfidence && (
                <Tag tone="warn">
                  <span title="Scores come from only a few reviews.">
                    low confidence · {film.reviewCount} review{film.reviewCount === 1 ? "" : "s"}
                  </span>
                </Tag>
              )}
            </div>
          )}

          {film.overview && (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fg-muted">
              {film.overview}
            </p>
          )}

          {quote && (
            <p className="mt-3 text-xs leading-relaxed text-fg-subtle">
              <span className="text-fg-faint">
                From a review{film.evidenceFeeling ? ` (${film.evidenceFeeling})` : ""}:
              </span>{" "}
              “{quote}
              {film.evidence && film.evidence.length >= 280 ? "…" : ""}”
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
