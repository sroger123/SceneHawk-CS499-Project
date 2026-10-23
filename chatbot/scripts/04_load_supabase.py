#!/usr/bin/env python3
"""Step 4 - load the corpus into Supabase (Postgres).

Loads in foreign-key order: feelings, then films, then reviews. Each table
depends on the one before it, so the order is not optional.

The 28 feelings are parsed out of docs/feelings-list.md rather than retyped
here, because that file is the source of truth. Edit the list there and re-run.

Safe to run more than once: every insert upserts on its primary key, so a
re-run updates rather than duplicating. It never touches review_labels, so
re-running cannot destroy anyone's labelling work.

Needs SUPABASE_DB_URL in chatbot/.env (Supabase dashboard > Connect >
"Connection pooling" > the URI, with your database password in it).

Run:  python scripts/04_load_supabase.py
      python scripts/04_load_supabase.py --dry-run     # parse + count, no writes
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
load_dotenv(ROOT / ".env")

FEELINGS_MD = ROOT / "docs" / "feelings-list.md"
FILMS = ROOT / "data" / "films_starter.json"
REVIEWS = ROOT / "data" / "reviews.jsonl"

BATCH = 1000          # rows per round trip; keeps memory flat on the 34k reviews
EXPECTED_FEELINGS = 28


def parse_feelings(path):
    """Pull (name, group, definition, example) out of the frozen markdown tables.

    The file is a series of `## Group` headings, each followed by a table whose
    rows are `| feeling | definition | example |`. Only the tables under a
    feeling group count - the header row, the `|---|` separator and the prose
    sections before and after are skipped.
    """
    rows, group = [], None
    skip = {"The labeling rule", "Borderline cases - decided",
            "Borderline cases — decided"}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            heading = line[3:].strip()
            group = None if heading in skip else heading
            continue
        if group is None or not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 3:
            continue
        name, definition, example = cells
        if name.lower() == "feeling" or set(name) <= set("-: "):
            continue                                  # header / separator row
        rows.append((name, group.replace("&", "and"), definition,
                     example.strip('"')))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="parse and count everything, write nothing")
    args = ap.parse_args()

    for p in (FEELINGS_MD, FILMS, REVIEWS):
        if not p.exists():
            sys.exit(f"{p} not found.")

    feelings = parse_feelings(FEELINGS_MD)
    if len(feelings) != EXPECTED_FEELINGS:
        sys.exit(f"parsed {len(feelings)} feelings from {FEELINGS_MD.name}, "
                 f"expected {EXPECTED_FEELINGS}. Check the tables in that file.")
    print(f"feelings: {len(feelings)} parsed from {FEELINGS_MD.name}")

    films = json.load(open(FILMS, encoding="utf-8"))
    print(f"films:    {len(films)}")

    n_reviews = sum(1 for _ in open(REVIEWS, encoding="utf-8"))
    print(f"reviews:  {n_reviews}")

    if args.dry_run:
        print("\n--- dry run, nothing written ---")
        for name, group, definition, _ in feelings[:3]:
            print(f"  {name:<16} {group:<22} {definition}")
        print("  ...")
        return

    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("SUPABASE_DB_URL is not set (put it in chatbot/.env).")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. feelings - everything else points here, so it goes first.
    execute_values(cur, """
        insert into feelings (name, group_name, definition, example)
        values %s
        on conflict (name) do update set
            group_name = excluded.group_name,
            definition = excluded.definition,
            example    = excluded.example
    """, feelings)
    print(f"feelings: {cur.rowcount} rows written")

    # 2. films - reviews reference films (tmdb_id), so films go before reviews.
    film_rows = [(
        f["tmdb_id"], f["imdb_id"], f["title"], f.get("year"),
        f.get("genres") or [], f.get("original_language"), f.get("overview"),
        f.get("popularity"), f.get("vote_average"), f.get("vote_count"),
        f.get("review_count", 0),
    ) for f in films]
    execute_values(cur, """
        insert into films (tmdb_id, imdb_id, title, year, genres,
                           original_language, overview, popularity,
                           vote_average, vote_count, review_count)
        values %s
        on conflict (tmdb_id) do update set
            title = excluded.title, year = excluded.year,
            genres = excluded.genres, overview = excluded.overview,
            popularity = excluded.popularity,
            vote_average = excluded.vote_average,
            vote_count = excluded.vote_count,
            review_count = excluded.review_count
    """, film_rows, page_size=BATCH)
    print(f"films:    {len(film_rows)} rows written")

    # 3. reviews - ~48 MB of text, so stream the file and send it in batches.
    #    label_split is left at its 'unlabeled' default: assigning reviews to
    #    the answer key / train / val / test splits is Week 3 work, and doing
    #    it here would overwrite those assignments on every re-run.
    known = {f["tmdb_id"] for f in films}
    batch, written, skipped = [], 0, 0
    sql = """
        insert into reviews (review_id, tmdb_id, text, source, split,
                             polarity, imdb_rating)
        values %s
        on conflict (review_id) do update set
            text = excluded.text, polarity = excluded.polarity,
            imdb_rating = excluded.imdb_rating
    """
    with open(REVIEWS, encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            if r["tmdb_id"] not in known:
                skipped += 1                 # no parent film; FK would reject it
                continue
            batch.append((r["review_id"], r["tmdb_id"], r["text"],
                          r.get("source", "aclImdb"), r.get("split"),
                          r.get("polarity"), r.get("imdb_rating")))
            if len(batch) >= BATCH:
                execute_values(cur, sql, batch, page_size=BATCH)
                written += len(batch)
                batch.clear()
                print(f"\r  reviews: {written}/{n_reviews}", end="", file=sys.stderr)
    if batch:
        execute_values(cur, sql, batch, page_size=BATCH)
        written += len(batch)
    print(f"\rreviews:  {written} rows written" + " " * 20)
    if skipped:
        print(f"          {skipped} skipped (film not in films_starter.json)")

    conn.commit()
    cur.close()
    conn.close()
    print("\ncommitted.")


if __name__ == "__main__":
    main()
