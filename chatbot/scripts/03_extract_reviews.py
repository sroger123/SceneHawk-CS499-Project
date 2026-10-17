#!/usr/bin/env python3
"""Step 3 - pull the review text for the starter films, clean it, write reviews.jsonl.

Cleaning: unescape HTML entities, strip tags (aclImdb is full of <br />), collapse
whitespace, drop reviews under MIN_CHARS, drop duplicates.

Run:  python scripts/03_extract_reviews.py
Out:  data/reviews.jsonl   (gitignored - regenerate rather than commit it)
"""
import collections
import html
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
IMDB = ROOT / "data" / "external" / "aclImdb"
FILMS = ROOT / "data" / "films_starter.json"
OUT = ROOT / "data" / "reviews.jsonl"

SPLITS = [("train", "pos"), ("train", "neg"), ("train", "unsup"),
          ("test", "pos"), ("test", "neg")]
TT = re.compile(r"/title/(tt\d+)/")
MIN_CHARS = 100

if not FILMS.exists():
    sys.exit(f"{FILMS} not found - run scripts/02_build_starter.py first.")

films = json.load(open(FILMS, encoding="utf-8"))
tt2tmdb = {f["imdb_id"]: f["tmdb_id"] for f in films}
print(f"{len(tt2tmdb)} starter films", file=sys.stderr)

raw = dropped_short = dropped_dupe = 0
seen, rows = set(), []

for split, pol in SPLITS:
    with open(IMDB / split / f"urls_{pol}.txt", encoding="utf-8") as f:
        urls = [ln.strip() for ln in f]
    d = IMDB / split / pol
    for name in os.listdir(d):
        if not name.endswith(".txt"):
            continue
        idx_s, _, rest = name.partition("_")
        idx = int(idx_s)
        m = TT.search(urls[idx]) if idx < len(urls) else None
        if not m or m.group(1) not in tt2tmdb:
            continue
        tt = m.group(1)
        raw += 1
        text = open(d / name, encoding="utf-8").read()
        text = html.unescape(text)
        text = re.sub(r"<[^>]+>", " ", text)       # aclImdb is full of <br />
        text = " ".join(text.split())
        if len(text) < MIN_CHARS:
            dropped_short += 1
            continue
        key = (tt, text[:200])
        if key in seen:
            dropped_dupe += 1
            continue
        seen.add(key)
        rating = rest.rsplit(".", 1)[0]
        rows.append({
            "review_id": f"{split}-{pol}-{idx}",
            "imdb_id": tt,
            "tmdb_id": tt2tmdb[tt],
            "text": text,
            "source": "aclImdb",
            "split": split,
            "polarity": pol,
            "imdb_rating": int(rating) if rating.isdigit() and rating != "0" else None,
        })

with open(OUT, "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

per = collections.Counter(r["imdb_id"] for r in rows)
vals = sorted(per.values())
lens = sorted(len(r["text"]) for r in rows)
print(f"\nraw reviews found     : {raw:,}")
print(f"dropped (<{MIN_CHARS} chars) : {dropped_short:,}")
print(f"dropped (duplicate)   : {dropped_dupe:,}")
print(f"KEPT                  : {len(rows):,}")
print(f"\nfilms covered         : {len(per):,}")
print(f"reviews/film  median  : {vals[len(vals) // 2]}   min: {min(vals)}   max: {max(vals)}")
print(f"review length median  : {lens[len(lens) // 2]} chars")
print(f"\n-> {OUT}")
