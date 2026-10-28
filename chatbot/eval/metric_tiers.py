#!/usr/bin/env python3
"""Decide which feelings the Week 10 result can honestly report on.

A feeling fails in two independent ways, and the fix is different for each:

  no training examples   -> the model cannot learn it. Its head outputs ~0.
  no answer-key examples -> recall is 0/0, undefined. There is no F1 to print,
                            however well the model does.

The second is a sample-size limit, not a labelling failure. The answer key is
206 reviews; a feeling that genuinely occurs in 2% of films turns up ~4 times
by arithmetic. `scared` has 48 training examples and 2 in the answer key - the
model can learn it, we just cannot measure it.

So: train on all 28 (sigmoid heads are independent, an unused one costs
nothing, and dropping a feeling from the label space is hard to undo once the
app is live), and report macro-F1 over REPORTABLE only - always named as such,
never as bare "macro-F1".

Counts come from the committed text-free label files, filtered to reviews that
actually exist in the corpus, so this runs with no database and no API key.
Re-run it after any labelling round; the tiers are meant to move.

Run:  python eval/metric_tiers.py
Out:  eval/metric_tiers.json
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # chatbot/
LABELS = ROOT / "data" / "labels"
REVIEWS = ROOT / "data" / "reviews.jsonl"
CORPUS_IDS = LABELS / "corpus_ids.txt"
OUT = Path(__file__).resolve().parent / "metric_tiers.json"

# file         the split it is
SPLITS = [("learning", "train"), ("checking", "val"), ("exam", "answer")]
META = {"id", "imdb_id"}

MIN_ANSWER_KEY = 3      # below this, one review swings F1 past meaning
MIN_TRAIN = 20          # below this the head is undertrained, not unlearnable
WIDE_CI = 8             # at or under this, say the confidence interval is wide


def classify(train, answer):
    """Which tier a feeling belongs in. Order matters: cannot_learn wins,
    because a feeling with no training examples is not worth measuring even
    if the answer key happens to contain it."""
    if train == 0:
        return "cannot_learn"
    if answer == 0:
        return "unmeasurable"
    if answer < MIN_ANSWER_KEY:
        return "trainable_only"
    return "reportable"


def corpus_ids():
    """The labelled reviews that have review text, so the counts below mean
    what can actually be trained on and scored.

    corpus_ids.txt is committed and is the preferred source. reviews.jsonl is
    the fallback for anyone who has the dataset locally. If neither is
    present this exits, because the earlier version quietly skipped the filter
    and counted all 3,774 label rows instead of 3,303 - `amused` came out at
    579 rather than 507 on a fresh clone, with nothing to flag it. A wrong
    number that looks right is worse than a stopped script.
    """
    if CORPUS_IDS.exists():
        return {line.strip() for line in
                open(CORPUS_IDS, encoding="utf-8") if line.strip()}
    if REVIEWS.exists():
        return {json.loads(line)["review_id"]
                for line in open(REVIEWS, encoding="utf-8")}
    sys.exit(f"Need {CORPUS_IDS.name} or reviews.jsonl to tell which labelled "
             f"reviews have text.\nRun scripts/08_export_labels.py (with the "
             f"corpus present) to regenerate {CORPUS_IDS.name}.")


def count():
    """feeling -> {train, val, answer}, over reviews the corpus really has."""
    known = corpus_ids()

    counts, feelings, dropped = {}, None, 0
    for name, split in SPLITS:
        p = LABELS / f"{name}_labels.csv"
        if not p.exists():
            sys.exit(f"{p} not found - run scripts/08_export_labels.py first.")
        rows = list(csv.DictReader(open(p, encoding="utf-8")))
        cols = [c for c in rows[0] if c not in META]
        if feelings is None:
            feelings = cols
            counts = {f: {"train": 0, "val": 0, "answer": 0} for f in cols}
        elif cols != feelings:
            sys.exit(f"{name}_labels.csv has different feeling columns.")
        for r in rows:
            # A review with no text in the corpus can never be scored, so its
            # labels must not inflate the counts the tiers are drawn from.
            # No `known and ...` guard here: an empty set used to turn this
            # filter into a no-op instead of an error.
            if r["id"] not in known:
                dropped += 1
                continue
            for f in cols:
                if str(r[f]).strip() == "1":
                    counts[f][split] += 1
    return counts, feelings, dropped


def main():
    counts, feelings, dropped = count()
    rows = []
    for f in feelings:
        c = counts[f]
        rows.append({"feeling": f, **c,
                     "tier": classify(c["train"], c["answer"]),
                     "wide_ci": 0 < c["answer"] <= WIDE_CI})
    rows.sort(key=lambda r: (-r["train"], -r["answer"]))

    print(f"{'feeling':<16}{'train':>7}{'val':>6}{'answer':>8}   tier")
    print("-" * 60)
    for r in rows:
        flag = " *" if r["wide_ci"] and r["tier"] == "reportable" else ""
        print(f"{r['feeling']:<16}{r['train']:>7}{r['val']:>6}"
              f"{r['answer']:>8}   {r['tier']}{flag}")
    print("-" * 60)

    tiers = {}
    for r in rows:
        tiers.setdefault(r["tier"], []).append(r["feeling"])
    for t in ("reportable", "trainable_only", "unmeasurable", "cannot_learn"):
        got = tiers.get(t, [])
        print(f"{t:<16} {len(got):>2}  {', '.join(got) if got else '-'}")

    wide = [r["feeling"] for r in rows if r["wide_ci"] and r["tier"] == "reportable"]
    print(f"\n* {len(wide)} of {len(tiers.get('reportable', []))} reportable "
          f"feelings have <= {WIDE_CI} answer-key examples. Report them, but "
          f"say the confidence is wide.")
    if dropped:
        print(f"\n{dropped} review rows ignored: not in the corpus "
              f"(non-film titles TMDB had no match for).")

    OUT.write_text(json.dumps({
        "generated_from": "data/labels/*_labels.csv, "
                          "filtered by data/labels/corpus_ids.txt",
        "thresholds": {"min_answer_key": MIN_ANSWER_KEY,
                       "min_train": MIN_TRAIN, "wide_ci": WIDE_CI},
        "headline_metric": "macro-F1 over the 'reportable' tier",
        "tiers": tiers,
        "wide_confidence": wide,
        "counts": {r["feeling"]: {k: r[k] for k in ("train", "val", "answer")}
                   for r in rows},
    }, indent=2) + "\n")
    print(f"\nwritten to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
