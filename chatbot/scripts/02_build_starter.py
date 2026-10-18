#!/usr/bin/env python3
"""Step 2 - pick the starter films and fetch their TMDB metadata.

Takes every film with >= MIN_REVIEWS reviews and resolves it on TMDB by its IMDb
id (TMDB's /find endpoint), so no MovieLens join is needed.

Needs TMDB_API_KEY in chatbot/.env

Run:  python scripts/02_build_starter.py
Out:  data/films_starter.json
"""
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
load_dotenv(ROOT / ".env")

MIN_REVIEWS = 20
COUNTS = ROOT / "data" / "external" / "review_counts.json"
OUT = ROOT / "data" / "films_starter.json"

KEY = os.environ.get("TMDB_API_KEY")
if not KEY:
    sys.exit("TMDB_API_KEY is not set (put it in chatbot/.env).")
if not COUNTS.exists():
    sys.exit(f"{COUNTS} not found - run scripts/01_count_reviews.py first.")

counts = json.load(open(COUNTS, encoding="utf-8"))
picked = sorted(((tt, n) for tt, n in counts.items() if n >= MIN_REVIEWS),
                key=lambda x: -x[1])
print(f"{len(picked)} films with >= {MIN_REVIEWS} reviews", file=sys.stderr)

g = requests.get("https://api.themoviedb.org/3/genre/movie/list",
                 params={"api_key": KEY, "language": "en-US"}, timeout=15).json()
GENRES = {x["id"]: x["name"] for x in g.get("genres", [])}

films, misses = [], 0
for i, (tt, n) in enumerate(picked, 1):
    try:
        r = requests.get(f"https://api.themoviedb.org/3/find/{tt}",
                         params={"api_key": KEY, "external_source": "imdb_id"},
                         timeout=15)
        r.raise_for_status()
        res = r.json().get("movie_results") or []
        if not res:
            misses += 1
        else:
            m = res[0]
            date = m.get("release_date") or ""
            films.append({
                "imdb_id": tt,
                "tmdb_id": m.get("id"),
                "title": m.get("title") or m.get("original_title"),
                "year": int(date[:4]) if date[:4].isdigit() else None,
                "genres": [GENRES.get(x, "Unknown") for x in m.get("genre_ids", [])],
                "original_language": m.get("original_language"),
                "overview": (m.get("overview") or "").strip(),
                "popularity": m.get("popularity"),
                "vote_average": m.get("vote_average"),
                "vote_count": m.get("vote_count"),
                "review_count": n,
            })
    except Exception:
        misses += 1
    if i % 200 == 0:
        print(f"  {i}/{len(picked)} resolved={len(films)} missed={misses}", file=sys.stderr)
    time.sleep(0.05)   # be polite to the API

json.dump(films, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"\nresolved {len(films)} / {len(picked)} films (missed {misses})")
print(f"with a description: {sum(1 for f in films if f['overview'])}")
print(f"reviews covered   : {sum(f['review_count'] for f in films):,}")
print(f"-> {OUT}")
