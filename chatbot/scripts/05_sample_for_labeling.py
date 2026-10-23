#!/usr/bin/env python3
"""Step 5 - sample reviews for hand labelling, and write one sheet per person.

Two rules shape the sample:

1. Sample from the `unsup` split. The pos/neg splits only hold reviews rated
   >=7 or <=4 - Stanford threw away the 5s and 6s to make a clean binary
   sentiment task. A lukewarm review is still good evidence about how a film
   feels, so we want the split that kept them.

2. Reserve whole films. The hand-labelled set is the answer key, and no film
   in it may appear in training, or the model can score well by recognising
   the film instead of reading feelings. So we pick films first, then take
   reviews from them, and record the reserved film ids for the LLM-labelling
   step to exclude.

Everyone also labels the same SHARED reviews, which is what the agreement
check in Week 3 compares.

Deterministic: same SEED gives the same sample, so a re-run does not quietly
hand people a different batch.

Run:  python scripts/05_sample_for_labeling.py
      python scripts/05_sample_for_labeling.py --films 150 --per-film 2
Out:  data/labeling/batch_<name>.csv   (one per labeller)
      data/labeling/manifest.json      (reserved films + who got what)
"""
import argparse
import csv
import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/

FILMS = ROOT / "data" / "films_starter.json"
REVIEWS = ROOT / "data" / "reviews.jsonl"
FEELINGS_MD = ROOT / "docs" / "feelings-list.md"
OUTDIR = ROOT / "data" / "labeling"

SEED = 49900
MAX_CHARS = 3000     # very long reviews make labelling miserable; see note below
MIN_CHARS = 300      # too short to carry evidence of a feeling


def parse_feelings(path):
    """The 28 feelings, in the order the frozen list gives them."""
    names, group = [], None
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
        name = cells[0]
        if name.lower() == "feeling" or set(name) <= set("-: "):
            continue
        names.append(name)
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labelers", default="roger,mate,apurba",
                    help="comma-separated names, lowercase")
    ap.add_argument("--films", type=int, default=150,
                    help="how many films to reserve for the answer key")
    ap.add_argument("--per-film", type=int, default=2,
                    help="reviews to take from each reserved film")
    ap.add_argument("--shared", type=int, default=50,
                    help="reviews every labeller gets, for the agreement check")
    args = ap.parse_args()

    for p in (FILMS, REVIEWS, FEELINGS_MD):
        if not p.exists():
            sys.exit(f"{p} not found.")

    feelings = parse_feelings(FEELINGS_MD)
    if len(feelings) != 28:
        sys.exit(f"parsed {len(feelings)} feelings, expected 28.")

    labelers = [n.strip() for n in args.labelers.split(",") if n.strip()]
    if not labelers:
        sys.exit("no labellers given.")

    films = {f["imdb_id"]: f for f in json.load(open(FILMS, encoding="utf-8"))}

    # Group the usable unsup reviews by film.
    by_film = defaultdict(list)
    seen = too_long = too_short = not_unsup = 0
    for line in open(REVIEWS, encoding="utf-8"):
        r = json.loads(line)
        seen += 1
        if r["polarity"] != "unsup":
            not_unsup += 1
            continue
        n = len(r["text"])
        if n > MAX_CHARS:
            too_long += 1
            continue
        if n < MIN_CHARS:
            too_short += 1
            continue
        by_film[r["imdb_id"]].append(r)

    eligible = {tt: rs for tt, rs in by_film.items() if len(rs) >= args.per_film}
    print(f"corpus:          {seen:,} reviews")
    print(f"  not unsup:     {not_unsup:,} (excluded - polarised splits)")
    print(f"  over {MAX_CHARS}:   {too_long:,} (excluded - too long to label)")
    print(f"  under {MIN_CHARS}:   {too_short:,} (excluded - too thin)")
    print(f"eligible films:  {len(eligible):,} with >= {args.per_film} usable reviews")

    if len(eligible) < args.films:
        sys.exit(f"only {len(eligible)} eligible films, asked for {args.films}.")

    rng = random.Random(SEED)
    picked_films = sorted(rng.sample(sorted(eligible), args.films))

    pool = []
    for tt in picked_films:
        rs = sorted(eligible[tt], key=lambda r: r["review_id"])
        pool.extend(rng.sample(rs, args.per_film))
    rng.shuffle(pool)

    if args.shared >= len(pool):
        sys.exit(f"--shared {args.shared} must be less than the pool ({len(pool)}).")

    shared = pool[:args.shared]
    rest = pool[args.shared:]

    # Deal the rest round-robin so the batches stay within one of each other.
    assigned = {name: list(shared) for name in labelers}
    for i, r in enumerate(rest):
        assigned[labelers[i % len(labelers)]].append(r)

    OUTDIR.mkdir(parents=True, exist_ok=True)
    header = ["id", "film", "year", "review", "labeler"] + feelings + ["notes"]

    for name in labelers:
        rows = assigned[name]
        rng.shuffle(rows)      # so the shared 50 are not all at the top
        out = OUTDIR / f"batch_{name}.csv"
        with open(out, "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(header)
            for r in rows:
                f = films[r["imdb_id"]]
                w.writerow([r["review_id"], f["title"], f.get("year") or "",
                            r["text"], name] + [""] * len(feelings) + [""])
        print(f"  {out.name:<22} {len(rows):>4} reviews "
              f"({args.shared} shared + {len(rows) - args.shared} own)")

    manifest = {
        "seed": SEED,
        "purpose": "answer_key",
        "note": ("These films are reserved for the hand-labelled answer key. "
                 "Exclude them when generating LLM training labels."),
        "labelers": labelers,
        "films_reserved": picked_films,
        "reviews_total": len(pool),
        "shared_review_ids": [r["review_id"] for r in shared],
        "assignments": {n: [r["review_id"] for r in rs]
                        for n, rs in assigned.items()},
    }
    (OUTDIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8")

    print()
    print(f"reserved {len(picked_films)} films / {len(pool)} reviews as the answer key")
    print(f"each person labels {args.shared} shared + ~{len(rest)//len(labelers)} own")
    print(f"manifest: {OUTDIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
