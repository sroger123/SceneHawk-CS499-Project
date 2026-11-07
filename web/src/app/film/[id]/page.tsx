import Link from "next/link";
import { notFound } from "next/navigation";
import AskBox from "@/components/AskBox";
import { Arrow, Card, Container, Eyebrow, Tag } from "@/components/ui";
import { getFilmRepository } from "@/lib/data";
import { exploreConnections } from "@/lib/explore";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-6 ${className ?? ""}`}>
      <h2 className="mb-4 font-display text-xl">{title}</h2>
      {children}
    </Card>
  );
}

function KV({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="capitalize text-fg-subtle">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-fg-muted">{children}</p>;
}

export default async function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = getFilmRepository();
  const [film, catalog] = await Promise.all([
    repo.getFilm(id),
    repo.listFilms(),
  ]);
  if (!film) notFound();

  const m = film.metadata;
  const connections = exploreConnections(film, catalog);

  return (
    <Container className="pb-24 pt-8 md:pt-10">
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-xs text-fg-subtle transition-colors hover:text-fg"
      >
        <span className="rotate-180">
          <Arrow />
        </span>
        Analysis index
      </Link>

      {/* Header */}
      <header className="mt-6 border-b border-line pb-10">
        <Eyebrow className="mb-3">{m.genres.join(", ")}</Eyebrow>
        <h1 className="text-balance break-words font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          {m.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-subtle">
          <span>
            <span className="text-fg-faint">Year</span>{" "}
            <span className="text-fg">{m.year}</span>
          </span>
          <span>
            <span className="text-fg-faint">Director</span>{" "}
            <span className="text-fg">{m.director}</span>
          </span>
          <span>
            <span className="text-fg-faint">Runtime</span>{" "}
            <span className="text-fg">{m.runtime} min</span>
          </span>
          <Tag tone="accent" className="capitalize">
            {m.popularity}
          </Tag>
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {film.atmosphere.map((a) => (
            <Tag key={a}>{a}</Tag>
          ))}
        </div>
      </header>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Section title="Atmosphere">
          <Prose>{film.analysis.atmosphere}</Prose>
          <p className="mt-4 text-xs text-fg-subtle">
            Jump-scare level:{" "}
            <span className="text-fg-muted">{film.jumpScares}</span>
          </p>
        </Section>

        <Section title="Narrative">
          <dl className="mb-4 divide-y divide-line border-y border-line">
            <KV k="pacing" v={film.narrative.pacing} />
            <KV k="structure" v={film.narrative.structure} />
            <KV k="storytelling" v={film.narrative.storytelling} />
            <KV k="dialogue" v={film.narrative.dialogue} />
          </dl>
          <Prose>{film.analysis.narrative}</Prose>
        </Section>

        <Section title="Visual language">
          <dl className="mb-4 divide-y divide-line border-y border-line">
            {Object.entries(film.visualStyle).map(([k, v]) => (
              <KV key={k} k={k} v={v} />
            ))}
          </dl>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {film.techniques.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <Prose>{film.analysis.visual}</Prose>
        </Section>

        <Section title="Themes & symbols">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {film.themes.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <Prose>{film.analysis.themes}</Prose>
          {film.symbols && film.symbols.length > 0 && (
            <p className="mt-4 text-xs text-fg-subtle">
              Recurring images: {film.symbols.join(" · ")}
            </p>
          )}
        </Section>

        <Section title="Inner lives" className="md:col-span-2">
          <Prose>{film.analysis.characters}</Prose>
        </Section>
      </div>

      {/* Exploration — cross-dimensional connections */}
      {connections.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 font-display text-2xl">Related films</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {connections.map((c) => (
              <Card
                key={c.film.id}
                href={`/film/${c.film.id}`}
                className="flex items-center justify-between gap-4 p-5"
              >
                <div>
                  <p className="text-xs font-medium text-accent first-letter:uppercase">
                    {c.relation}
                  </p>
                  <p className="mt-1.5 font-display text-lg">
                    {c.film.metadata.title}
                    <span className="ml-2 font-sans text-sm text-fg-subtle">
                      {c.film.metadata.year}
                    </span>
                  </p>
                </div>
                <span className="text-fg-faint group-hover:text-accent">
                  <Arrow />
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Ask about this film — RAG over its analytical chunks */}
      <section className="mt-16">
        <h2 className="mb-4 font-display text-2xl">Questions about {m.title}</h2>
        <AskBox filmId={film.id} />
      </section>
    </Container>
  );
}
