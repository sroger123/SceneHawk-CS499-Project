#!/usr/bin/env python3
"""Step 6 - add the films and reviews the labelled splits need.

The learning/checking/exam splits were sampled from the whole aclImdb corpus,
not from the 1,259-film starter set, so most of the films they reference have
no row in films_starter.json and most of their reviews are not in
reviews.jsonl. Loading the labels would fail on the foreign keys.

That is fine for training: the model reads one review at a time and never sees
how many reviews a film has, so the 20-review threshold does not apply here.
It still applies in Week 5, when reviews are aggregated into film profiles -
filter on films.review_count then.

This script resolves the missing films on TMDB (same /find lookup as step 2)
and extracts their review text (same cleaning as step 3), appending to both
files. Safe to re-run: anything already present is skipped, so only what is
genuinely missing costs an API call.

Needs TMDB_API_KEY in chatbot/.env

Run:  python scripts/06_expand_films.py
      python scripts/06_expand_films.py --dry-run
Out:  data/films_starter.json, data/reviews.jsonl   (both appended in place)
"""
import argparse
import csv
import html
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
load_dotenv(ROOT / ".env")

SPLITS = ["learning", "checking", "exam"]
FILMS = ROOT / "data" / "films_starter.json"
REVIEWS = ROOT / "data" / "reviews.jsonl"
ACL = ROOT / "data" / "external" / "aclImdb"

TT = re.compile(r"/title/(tt\d+)/")
MIN_CHARS = 20


def wanted():
    """Every (review_id -> imdb_id) the three split files refer to."""
    pairs = {}
    for name in SPLITS:
        p = ROOT / "data" / f"{name}.csv"
        if not p.exists():
            sys.exit(f"{p} not found.")
        for r in csv.DictReader(open(p, encoding="utf-8")):
            pairs[r["id"]] = r["imdb_id"]
    return pairs


def build_index():
    """review_id -> (path, imdb_id, split, polarity, stars) for all of aclImdb.

    The review files carry no film id; the id comes from the parallel
    urls_<polarity>.txt, where review file N corresponds to line N+1. The
    review_id scheme is the one step 3 used: '<split>-<polarity>-<index>'.
    """
    idx = {}
    for split in ("train", "test"):
        for pol in ("pos", "neg", "unsup"):
            folder = ACL / split / pol
            urls = ACL / split / f"urls_{pol}.txt"
            if not folder.is_dir() or not urls.exists():
                continue
            lines = urls.read_text(encoding="utf-8").splitlines()
            for fn in os.listdir(folder):
                n, _, rest = fn.partition("_")
                if not n.isdigit():
                    continue
                i = int(n)
                m = TT.search(lines[i]) if i < len(lines) else None
                if not m:
                    continue
                stars = rest.rsplit(".", 1)[0]
                idx[f"{split}-{pol}-{i}"] = (
                    folder / fn, m.group(1), split, pol,
                    int(stars) if stars.isdigit() else None)
    return idx


def clean(text):
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)       # aclImdb is full of <br />
    return " ".join(text.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="parse and count everything, write nothing")
    ap.add_argument("--sleep", type=float, default=0.0,
                    help="seconds to wait between TMDB calls")
    args = ap.parse_args()

    if not FILMS.exists():
        sys.exit(f"{FILMS} not found - run scripts/02_build_starter.py first.")

    films = json.load(open(FILMS, encoding="utf-8"))
    have_tt = {f["imdb_id"] for f in films}
    have_rev = set()
    if REVIEWS.exists():
        for line in open(REVIEWS, encoding="utf-8"):
            have_rev.add(json.loads(line)["review_id"])

    pairs = wanted()
    need_tt = sorted({tt for tt in pairs.values() if tt not in have_tt})
    need_rev = sorted(rid for rid in pairs if rid not in have_rev)

    print(f"splits reference {len(pairs):,} reviews across "
          f"{len(set(pairs.values())):,} films")
    print(f"  films to resolve on TMDB: {len(need_tt):,}")
    print(f"  reviews to extract:       {len(need_rev):,}")

    if args.dry_run:
        print("\n--- dry run, nothing written ---")
        return
    if not need_tt and not need_rev:
        print("\nnothing to do.")
        return

    key = os.environ.get("TMDB_API_KEY")
    if need_tt and not key:
        sys.exit("TMDB_API_KEY is not set (put it in chatbot/.env).")

    # 1. resolve the missing films, one /find call each
    added, missed = [], []
    for i, tt in enumerate(need_tt, 1):
        try:
            r = requests.get(f"https://api.themoviedb.org/3/find/{tt}",
                             params={"api_key": key,
                                     "external_source": "imdb_id"}, timeout=15)
            res = r.json().get("movie_results") or []
        except Exception as e:                   # one bad call must not stop 1,900
            print(f"\n  {tt}: {e}", file=sys.stderr)
            missed.append(tt)
            continue
        if not res:
            missed.append(tt)
        else:
            m = res[0]
            added.append({
                "imdb_id": tt,
                "tmdb_id": m["id"],
                "title": m.get("title"),
                "year": int(m["release_date"][:4]) if m.get("release_date") else None,
                "genres": [],                    # /find returns ids only
                "original_language": m.get("original_language"),
                "overview": m.get("overview"),
                "popularity": m.get("popularity"),
                "vote_average": m.get("vote_average"),
                "vote_count": m.get("vote_count"),
                "review_count": 0,               # recomputed at the end
            })
        if i % 50 == 0 or i == len(need_tt):
            print(f"\r  TMDB {i}/{len(need_tt)}  resolved {len(added)}  "
                  f"missed {len(missed)}", end="", file=sys.stderr)
        if args.sleep:
            time.sleep(args.sleep)
    print(file=sys.stderr)

    films.extend(added)
    by_tt = {f["imdb_id"]: f for f in films}

    # 2. extract the review text for the ids the splits need
    print("  indexing aclImdb ...", file=sys.stderr)
    idx = build_index()
    new_rows, skipped = [], 0
    for rid in need_rev:
        hit = idx.get(rid)
        if not hit:
            skipped += 1                         # not in the dataset at all
            continue
        path, tt, split, pol, stars = hit
        film = by_tt.get(tt)
        if film is None:
            skipped += 1                         # its film never resolved
            continue
        text = clean(path.read_text(encoding="utf-8"))
        if len(text) < MIN_CHARS:
            skipped += 1
            continue
        new_rows.append({
            "review_id": rid, "imdb_id": tt, "tmdb_id": film["tmdb_id"],
            "text": text, "source": "aclImdb", "split": split,
            "polarity": pol, "imdb_rating": stars,
        })

    with open(REVIEWS, "a", encoding="utf-8") as fh:
        for row in new_rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    # 3. recompute review_count over everything the corpus now holds, so the
    #    Week 5 "at least 20 reviews" filter still has a number to work from
    counts = {}
    for line in open(REVIEWS, encoding="utf-8"):
        tt = json.loads(line)["imdb_id"]
        counts[tt] = counts.get(tt, 0) + 1
    for f in films:
        f["review_count"] = counts.get(f["imdb_id"], 0)

    with open(FILMS, "w", encoding="utf-8") as fh:
        json.dump(films, fh, ensure_ascii=False, indent=1)

    print()
    print(f"films:   +{len(added):,} added, {len(missed):,} not found on TMDB "
          f"-> {len(films):,} total")
    print(f"reviews: +{len(new_rows):,} added, {skipped:,} skipped "
          f"-> {len(have_rev) + len(new_rows):,} total")
    got = {r["review_id"] for r in new_rows}
    still = [rid for rid in need_rev if rid not in got]
    if still:
        print(f"\n{len(still):,} split reviews still have no row - their labels "
              f"cannot load. Re-run to retry films that failed on a network error.")


if __name__ == "__main__":
    main()
