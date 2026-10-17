#!/usr/bin/env python3
"""Step 1 - count how many reviews each film has in the aclImdb dataset.

Each review file is named {index}_{rating}.txt, where {index} is the line number
in that split's urls_*.txt file. That line holds the film's IMDb URL, which gives
us the tt id - so reviews group by film without opening a single review.

Run:  python scripts/01_count_reviews.py
Out:  data/external/review_counts.json  ({tt_id: n_reviews})
"""
import collections
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
IMDB = ROOT / "data" / "external" / "aclImdb"
OUT = ROOT / "data" / "external" / "review_counts.json"

SPLITS = [("train", "pos"), ("train", "neg"), ("train", "unsup"),
          ("test", "pos"), ("test", "neg")]
TT = re.compile(r"/title/(tt\d+)/")

if not IMDB.exists():
    sys.exit(f"{IMDB} not found.\n"
             "Download and extract the dataset first:\n"
             "  https://ai.stanford.edu/~amaas/data/sentiment/aclImdb_v1.tar.gz\n"
             f"  -> extract into {IMDB.parent}")

counts = collections.Counter()
unmatched = 0

for split, pol in SPLITS:
    with open(IMDB / split / f"urls_{pol}.txt", encoding="utf-8") as f:
        urls = [ln.strip() for ln in f]
    d = IMDB / split / pol
    for name in os.listdir(d):
        if not name.endswith(".txt"):
            continue
        idx = int(name.split("_", 1)[0])
        m = TT.search(urls[idx]) if idx < len(urls) else None
        if m:
            counts[m.group(1)] += 1
        else:
            unmatched += 1

total = sum(counts.values())
films = len(counts)
print(f"reviews parsed : {total:,}   (unmatched: {unmatched})")
print(f"unique films   : {films:,}\n")
print("films with at least N reviews:")
for n in (1, 5, 10, 15, 20, 25, 30):
    k = sum(1 for v in counts.values() if v >= n)
    print(f"  >= {n:>2} : {k:>6,} films   ({100.0 * k / films:5.1f}%)")

vals = sorted(counts.values())
print(f"\nmedian: {vals[len(vals) // 2]}   mean: {total / films:.1f}   max: {max(vals)}")

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(counts, open(OUT, "w", encoding="utf-8"))
print(f"\n-> {OUT}")
