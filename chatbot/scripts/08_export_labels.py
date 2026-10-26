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
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
OUT = ROOT / "data" / "labels"
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

print(f"\ncolumns kept: id, imdb_id + the 28 feelings")
print(f"total: {total_in/1024/1024:.1f} MB -> {total_out/1024:.0f} KB")
print(f"written to {OUT}")
