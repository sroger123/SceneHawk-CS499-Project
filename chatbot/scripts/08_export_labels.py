#!/usr/bin/env python3
"""Step 8 - write label-only copies of the splits, safe to commit.

learning/checking/exam.csv each carry the full aclImdb review text - about
5 MB in total - which is not ours to redistribute, so those files are
gitignored alongside reviews.jsonl.

The labels, though, are the team's own work and the most expensive thing in
the repo to recreate. This writes a copy of each split with the review text
dropped, keeping the ids and the 28 feelings. Anyone with the Stanford dataset
can rejoin the text on `id`.

Run:  python scripts/08_export_labels.py
Out:  data/labels/{learning,checking,exam}_labels.csv
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
OUT = ROOT / "data" / "labels"
REVIEWS = ROOT / "data" / "reviews.jsonl"
SPLITS = ["learning", "checking", "exam"]
DROP = {"review", "film", "year", "notes"}         # text columns, not labels

OUT.mkdir(parents=True, exist_ok=True)
total_in = total_out = 0

for name in SPLITS:
    src = ROOT / "data" / f"{name}.csv"
    if not src.exists():
        sys.exit(f"{src} not found.")
    rows = list(csv.DictReader(open(src, encoding="utf-8")))
    keep = [c for c in rows[0] if c not in DROP]
    dst = OUT / f"{name}_labels.csv"
    with open(dst, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keep, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    a, b = src.stat().st_size, dst.stat().st_size
    total_in += a
    total_out += b
    marks = sum(1 for r in rows for c in keep
                if c not in ("id", "imdb_id") and str(r[c]).strip() == "1")
    print(f"{name + '.csv':<14} {len(rows):>5} rows | {marks:>5} marks | "
          f"{a/1024:>7.0f} KB -> {b/1024:>6.0f} KB")

# Which of these labelled reviews actually have review text in the corpus.
# 471 do not: they are the non-film titles TMDB had no match for, see
# scripts/06_expand_films.py.
#
# This list has to be committed rather than recomputed downstream.
# reviews.jsonl carries aclImdb text and is gitignored, so anything that
# filtered against it got an empty set on a fresh clone and silently counted
# all 3,774 label rows instead of the 3,303 usable ones - eval/metric_tiers.py
# put `amused` at 579 rather than 507, with nothing to say the filter had not
# run. Review ids are not review text, so they can live in git and make the
# filter reproducible anywhere.
if REVIEWS.exists():
    known = {json.loads(line)["review_id"]
             for line in open(REVIEWS, encoding="utf-8")}
    usable = sorted(
        r["id"]
        for name in SPLITS
        for r in csv.DictReader(
            open(ROOT / "data" / f"{name}.csv", encoding="utf-8"))
        if r["id"] in known)
    (OUT / "corpus_ids.txt").write_text("\n".join(usable) + "\n",
                                        encoding="utf-8")
    print(f"\ncorpus_ids.txt: {len(usable):,} of the labelled reviews have "
          f"text in the corpus")
else:
    print(f"\n{REVIEWS} not found, leaving corpus_ids.txt untouched.")

print(f"\ncolumns kept: id, imdb_id + the 28 feelings")
print(f"total: {total_in/1024/1024:.1f} MB -> {total_out/1024:.0f} KB")
print(f"written to {OUT}")
