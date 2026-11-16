import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import TableMatchCard from "@/components/TableMatchCard";
import { Card, Container, Em, Label, Notice, PageHeader, Tag, pillClass } from "@/components/ui";
import {
  searchByFeeling,
  searchStatus,
  supabaseConfig,
  type FeelingSearch,
} from "@/lib/feelings/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

// The main search: the same query step as /chat. The request is read into
// feelings, story words and genres, then Supabase's match_films() ranks films
// by the feelings table (filled offline by our model) and the description
// table. The four-system research prototype lives at /search/prototype.

const RESULTS = 10;

// Each of these reads cleanly into feelings, story words and genres, and uses
// feelings the model has enough examples of.
const STARTERS = [
  "something cozy for a rainy Sunday",
  "a tense heist movie, not horror",
  "a thrilling space adventure",
  "something heartwarming about friendship",
  "a hopeful sci-fi about first contact",
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ = "" } = await searchParams;
  const q = rawQ.trim().slice(0, 500);
  const configured = supabaseConfig() !== null;

  let result: FeelingSearch | null = null;
  let filmCount: number | null = null;
  let failed = false;
  if (configured) {
    try {
      if (q) {
        result = await searchByFeeling(q, RESULTS);
      } else {
        filmCount = (await searchStatus())?.films_with_feelings ?? null;
      }
    } catch (err) {
      console.error("table search failed", err);
      failed = true;
    }
  }

  const read = result?.read;
  // A film that scores 0 matched nothing in the request (no feeling or story
  // word recognised, or story words no description contains): its place in the
  // list comes only from popularity, so it isn't shown as a match.
  const understood = !!read && (read.feelings.length > 0 || read.storyTerms.length > 0);
  const films = understood ? (result?.films ?? []).filter((f) => f.score > 0) : [];

  return (
    <Container className="pb-24">
      {!q ? (
        <PageHeader
          center
          title={
            <>
              Search films by <Em>feeling</Em>
            </>
          }
          lead={
            filmCount
              ? `Describe how you want to feel, or the story you want. Results come from ${filmCount.toLocaleString("en-US")} films, scored by our feelings model from their reviews.`
              : "Describe how you want to feel, or the story you want. Films are scored by our feelings model from their reviews."
          }
        />
      ) : (
        <div className="pt-10" />
      )}

      <div className="mx-auto max-w-3xl">
        <SearchBox initial={q} autoFocus={!q} />
      </div>

      {!configured && (
        <div className="mx-auto mt-6 max-w-3xl">
          <Notice>
            The film database isn&apos;t connected. Set SUPABASE_URL and SUPABASE_ANON_KEY (see
            DEPLOY.md), then reload.
          </Notice>
        </div>
      )}

      {failed && (
        <div className="mx-auto mt-6 max-w-3xl">
          <Notice>
            The film database didn&apos;t answer. Try again in a moment.
          </Notice>
        </div>
      )}

      {!q && (
        <div className="mx-auto mt-10 max-w-3xl">
          <Label className="mb-3 text-center">Example searches</Label>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <Link
                key={s}
                href={`/search?q=${encodeURIComponent(s)}`}
                className={pillClass()}
              >
                {s}
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-fg-faint">
            Looking for the four-system research comparison?{" "}
            <Link href="/search/prototype" className="underline hover:text-fg">
              Open the prototype
            </Link>
            .
          </p>
        </div>
      )}

      {read && (
        <div className="mx-auto mt-8 max-w-3xl">
          <div className="rounded-[14px] border border-line bg-surface p-5">
            <Label className="mb-3">Read as</Label>
            {understood || read.genres.length || read.notGenres.length || read.avoid.length ? (
              <div className="flex flex-wrap gap-1.5">
                <Chip label="feelings" values={read.feelings} />
                <Chip label="avoid" values={[...read.avoid, ...read.notGenres]} />
                <Chip label="genres" values={read.genres} />
                <Chip label="story" values={read.storyTerms} />
              </div>
            ) : (
              <p className="text-sm text-fg-subtle">Nothing we could match.</p>
            )}
          </div>

          {films[0]?.genreRelaxed && (
            <div className="mt-6">
              <Notice>Too few films had that genre, so the genre filter was loosened.</Notice>
            </div>
          )}

          <div className="mt-10 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Matching films</h2>
              <span className="shrink-0 text-xs text-fg-faint">
                {films.length} result{films.length === 1 ? "" : "s"}
              </span>
            </div>
            {films.length === 0 && (
              <Card className="p-6 text-sm text-fg-subtle">
                No films matched. Try describing the feeling (tense, cozy, sad, funny…) or
                the story (a heist, a road trip, first contact…) in other words.
              </Card>
            )}
            {films.map((f, idx) => (
              <TableMatchCard key={f.tmdbId} film={f} rank={idx + 1} />
            ))}
          </div>

          {films.length > 0 && (
            <p className="mt-6 text-xs leading-relaxed text-fg-faint">
              Match is a retrieval score: how well a film&apos;s feeling scores and description
              fit your request. It isn&apos;t a quality rating. Feeling scores are the average our
              model gave the film&apos;s reviews, from 0 to 1. Titles open on TMDB.
            </p>
          )}
        </div>
      )}
    </Container>
  );
}
