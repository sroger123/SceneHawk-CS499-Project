import { Card, Tag } from "@/components/ui";
import type { Dimension, FilmScore } from "@/lib/types";

const DIM_LABEL: Record<string, string> = {
  themes: "Themes",
  atmosphere: "Atmosphere",
  narrative: "Narrative",
  visual: "Visual style",
  characters: "Characters",
};

export default function MatchCard({
  score,
  rank,
}: {
  score: FilmScore;
  rank?: number;
}) {
  const m = score.film.metadata;
  const dims = Object.keys(score.dimensionScores) as Dimension[];

  return (
    <Card href={`/film/${score.film.id}`} className="p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-5">
        {rank !== undefined && (
          <span className="hidden w-6 shrink-0 pt-1 font-display text-lg text-fg-faint sm:block">
            {String(rank).padStart(2, "0")}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words font-display text-xl font-semibold leading-snug transition-colors group-hover:text-accent sm:text-2xl">
                {m.title}
              </h3>
              <p className="mt-1 text-sm text-fg-subtle">
                {m.year} · dir. {m.director}
                <span className="text-fg-faint"> · {m.genres.join(", ")}</span>
              </p>
            </div>

            {/* Retrieval score — not a quality rating. Keep the label. */}
            <div
              className="shrink-0 text-right"
              title="Retrieval score: how strongly this film's analysis matches your description. Not a quality rating."
            >
              <div className="font-display text-[28px] leading-none tabular-nums text-accent">
                {score.displayScore}
              </div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
                Cinematic match
              </div>
            </div>
          </div>

          {dims.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dims.map((d) => (
                <Tag key={d}>{DIM_LABEL[d]}</Tag>
              ))}
            </div>
          )}

          {score.explanation && (
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">
              {score.explanation}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
