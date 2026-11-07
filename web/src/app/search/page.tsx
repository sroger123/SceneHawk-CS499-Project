import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import SearchBox from "@/components/SearchBox";
import { Card, Container, Em, Label, Notice, PageHeader, Tag, pillClass } from "@/components/ui";
import { getFilmRepository } from "@/lib/data";
import { buildAgentContext, runSearch } from "@/lib/pipelines";
import {
  PIPELINE_LABELS,
  PIPELINE_MODES,
  type PipelineMode,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const STARTERS = [
  "Something isolated and unsettling where the tension builds slowly without jump scares",
  "Something melancholic and visually beautiful about loneliness",
  "Incredible cinematography, long takes, meditative pacing",
  "An obscure psychological horror film — a hidden gem",
  "A mystery that deliberately refuses to resolve",
  "Slow contemplative sci-fi rather than action-packed",
];

function Chip({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <Tag>
      <span className="mr-1 text-fg-faint">{label}</span> {values.join(", ")}
    </Tag>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const { q = "", mode: rawMode } = await searchParams;
  const mode = (PIPELINE_MODES as string[]).includes(rawMode ?? "")
    ? (rawMode as PipelineMode)
    : "multi";

  const films = await getFilmRepository().listFilms();
  const ctx = await buildAgentContext(films);
  const result = q ? await runSearch(q, mode, ctx) : null;
  const i = result?.interpretation;

  return (
    <Container className="pb-24">
      {!q ? (
        <PageHeader
          center
          title={
            <>
              Search films by <Em>mood</Em>
            </>
          }
          lead={`Describe the experience you want, not the genre. Results come from ${films.length} analyzed films.`}
        />
      ) : (
        <div className="pt-10" />
      )}

      <div className="mx-auto max-w-3xl">
        <SearchBox initial={q} mode={mode} autoFocus={!q} />
      </div>

      {!q && (
        <div className="mx-auto mt-10 max-w-3xl">
          <Label className="mb-3 text-center">Example searches</Label>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <Link
                key={s}
                href={`/search?q=${encodeURIComponent(s)}&mode=multi`}
                className={pillClass()}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="mx-auto mt-8 max-w-3xl">
          {/* System selector — this is the research comparison */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label>System</Label>
            <nav
              aria-label="Recommendation system"
              className="flex flex-wrap gap-1.5"
            >
              {PIPELINE_MODES.map((m) => (
                <Link
                  key={m}
                  aria-current={m === mode ? "page" : undefined}
                  href={`/search?q=${encodeURIComponent(q)}&mode=${m}`}
                  className={pillClass(m === mode)}
                >
                  {PIPELINE_LABELS[m]}
                </Link>
              ))}
            </nav>
          </div>

          {result.note && (
            <div className="mt-6">
              <Notice>{result.note}</Notice>
            </div>
          )}

          {i && (i.source === "llm" || mode === "multi" || mode === "rag") && (
            <div className="mt-6 rounded-[14px] border border-line bg-surface p-5">
              <Label className="mb-3">Interpreted as · {i.source}</Label>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="themes" values={i.themes} />
                <Chip label="mood" values={i.mood} />
                <Chip label="pacing" values={i.pacing} />
                <Chip label="narrative" values={i.narrative} />
                <Chip label="visual" values={i.visual} />
                <Chip label="avoid" values={i.avoid} />
                <Chip label="genres" values={i.genres} />
                {i.preferObscure && <Tag tone="warn">prefer: lesser-known</Tag>}
              </div>
            </div>
          )}

          <div className="mt-10 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Matching films</h2>
              <span className="shrink-0 text-xs text-fg-faint">
                {result.results.length} result
                {result.results.length === 1 ? "" : "s"}
              </span>
            </div>
            {result.results.length === 0 && (
              <Card className="p-6 text-sm text-fg-subtle">
                No films matched. Describe the mood, pacing, themes or visual
                style in other words, or switch to another system above.
              </Card>
            )}
            {result.results.map((s, idx) => (
              <MatchCard key={s.film.id} score={s} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
