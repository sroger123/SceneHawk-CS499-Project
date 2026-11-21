#!/usr/bin/env python3
"""Step 9 - turn the labelled splits into something a model can train on.

One JSON object per review: the text, and a vector of 0/1, one per feeling the
model learns, in the fixed order of docs/feelings-list.md. The order is read
from that file rather than from a CSV header, so column 7 means the same
feeling in training, in scoring and in the database.

The labels use all 28 feelings. The model learns 21: docs/feeling-merges.json
folds 6 rare feelings into a common one (a review marked `dread` counts as
`tense`) and drops `drained`. The CSVs are never changed, so the merge can be
changed or undone by editing that file and re-running this script.

A review with no feelings is kept, not dropped. 60% of the training rows are
blank, and those are the negative examples - a sigmoid head needs to see
reviews that are not `amused` in order to learn what `amused` is. Dropping
them would leave the model unable to say no to anything.

Reviews missing from the corpus are skipped: those are the non-film titles
TMDB had no match for (see 06_expand_films.py).

Output carries the full review text, so data/training/ is gitignored.

Run:  python scripts/09_build_training_data.py
Out:  data/training/{train,val,answer_key}.jsonl + meta.json
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # chatbot/
OUT = ROOT / "data" / "training"
REVIEWS = ROOT / "data" / "reviews.jsonl"
FEELINGS_MD = ROOT / "docs" / "feelings-list.md"
MERGES = ROOT / "docs" / "feeling-merges.json"

# source file   split name the model sees
SPLITS = [("learning", "train"), ("checking", "val"), ("exam", "answer_key")]
META = {"id", "imdb_id", "review", "film", "year", "labeler", "notes", "source"}


def parse_feelings(path):
    """The 28 names in document order - the same parser step 7 uses, so the
    label vector cannot drift from what the database holds."""
    names, group = [], None
    skip = {"The labeling rule", "Borderline cases - decided",
            "Borderline cases — decided"}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            h = line[3:].strip()
            group = None if h in skip else h
            continue
        if group is None or not line.startswith("|"):
            continue
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(c) != 3 or c[0].lower() == "feeling" or set(c[0]) <= set("-: "):
            continue
        names.append(c[0])
    return names


def model_feelings(feelings, merges):
    """The feelings the model learns, in document order, and for each one the
    label columns that count toward it: itself plus anything merged into it."""
    merged, dropped = merges["merged_into"], set(merges["dropped"])
    bad = [f for f in [*merged, *merged.values(), *dropped] if f not in feelings]
    if bad:
        sys.exit(f"{MERGES.name} names feelings not in the list: {bad}")
    kept = [f for f in feelings if f not in merged and f not in dropped]
    lost = [t for t in merged.values() if t not in kept]
    if lost:
        sys.exit(f"{MERGES.name} merges into feelings that are themselves "
                 f"merged or dropped: {lost}")
    return kept, {f: [f] + [s for s, t in merged.items() if t == f] for f in kept}


def main():
    source = parse_feelings(FEELINGS_MD)
    if len(source) != 28:
        sys.exit(f"parsed {len(source)} feelings, expected 28.")
    merges = json.loads(MERGES.read_text(encoding="utf-8"))
    feelings, sources = model_feelings(source, merges)

    known = set()
    if REVIEWS.exists():
        for line in open(REVIEWS, encoding="utf-8"):
            known.add(json.loads(line)["review_id"])

    OUT.mkdir(parents=True, exist_ok=True)
    summary = {}
    for name, split in SPLITS:
        src = ROOT / "data" / f"{name}.csv"
        if not src.exists():
            sys.exit(f"{src} not found.")
        rows = list(csv.DictReader(open(src, encoding="utf-8")))
        cols = [c for c in rows[0] if c not in META]
        unknown = [c for c in cols if c not in set(source)]
        if unknown:
            sys.exit(f"{name}.csv has columns that are not feelings: {unknown}")

        kept, skipped, blank, marks = [], 0, 0, 0
        for r in rows:
            if known and r["id"] not in known:
                skipped += 1
                continue
            vec = [1 if any(str(r.get(s, "")).strip() == "1" for s in sources[f])
                   else 0 for f in feelings]
            marks += sum(vec)
            if not any(vec):
                blank += 1
            kept.append({"id": r["id"], "imdb_id": r["imdb_id"],
                         "text": r["review"], "labels": vec})

        dst = OUT / f"{split}.jsonl"
        with open(dst, "w", encoding="utf-8") as fh:
            for row in kept:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

        summary[split] = {"rows": len(kept), "marks": marks, "blank": blank,
                          "skipped_not_in_corpus": skipped}
        print(f"{split:<11} {len(kept):>5} rows | {marks:>5} marks | "
              f"{blank:>5} blank ({blank/len(kept)*100:.0f}%) | "
              f"{skipped:>4} skipped")

    # Per-feeling positives in train, so the trainer can weight the loss
    # without re-reading the CSVs.
    pos = [0] * len(feelings)
    for line in open(OUT / "train.jsonl", encoding="utf-8"):
        for i, v in enumerate(json.loads(line)["labels"]):
            pos[i] += v
    (OUT / "meta.json").write_text(json.dumps({
        "feelings": feelings,
        "label_order": "docs/feelings-list.md, document order, after the merges",
        "source_feelings": source,
        "merged_into": merges["merged_into"],
        "dropped": merges["dropped"],
        "train_positives": dict(zip(feelings, pos)),
        "splits": summary,
        "note": "Blank rows are negative examples, not missing data.",
    }, indent=2) + "\n")

    print(f"\nlabel vector: {len(feelings)} wide, order from docs/feelings-list.md "
          f"after {MERGES.name}")
    print(f"rarest in train: " + ", ".join(
        f"{f}={n}" for f, n in sorted(zip(feelings, pos), key=lambda x: x[1])[:5]))
    print(f"written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
