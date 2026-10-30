#!/usr/bin/env python3
"""Is one model's lead over another real, or a few lucky reviews?

Compares two systems on the answer key using their frozen thresholds, with a
paired bootstrap on the macro-F1 difference. Fits nothing and writes nothing,
so running it does not spend the answer key any further than scoring did.

The bootstrap resamples whole films, not reviews. Reviews of one film are not
independent, and the splits are by film, so resampling reviews would claim more
certainty than 162 films can give.

The range covers which answer-key films happened to be drawn. It does not cover
training variation between runs, so it says nothing about a rerun of the model.

Needs eval/preds/<name>_answer_key.jsonl and eval/thresholds_<name>.json.

Run:  python eval/compare.py baseline distilroberta
"""
import argparse
import csv
import json
import random
import sys
from pathlib import Path

from score import (LABELS, SPLIT_SOURCE, TIERS, TRAIN_DIR, confusion,
                   load_jsonl, load_truth, macro_f1, prf)

HERE = Path(__file__).resolve().parent
SEED = 49900                                           # same seed as sampling
ROUNDS = 2000


def load_system(name):
    preds = load_jsonl(HERE / "preds" / f"{name}_answer_key.jsonl", "scores")
    path = HERE / f"thresholds_{name}.json"
    if not path.exists():
        sys.exit(f"{path} not found - run score.py --tune on val first.")
    return preds, json.loads(path.read_text(encoding="utf-8"))


def f1s(truth, preds, thr, feelings, names):
    out = {}
    for f in names:
        i = feelings.index(f)
        _, _, f1 = prf(*confusion(truth, preds, i, thr[f]))
        out[f] = {"f1": f1}
    return out


def films_of(ids):
    """imdb_id -> review ids, from the committed labels so no review text is
    needed. Sorted, so a given seed draws the same films on any machine."""
    path = LABELS / f"{SPLIT_SOURCE['answer_key']}_labels.csv"
    films = {}
    with open(path, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["id"] in ids:
                films.setdefault(r["imdb_id"], []).append(r["id"])
    return {k: films[k] for k in sorted(films)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", help="the system to compare against, e.g. baseline")
    ap.add_argument("b", help="the challenger, e.g. distilroberta")
    args = ap.parse_args()

    meta = json.loads((TRAIN_DIR / "meta.json").read_text(encoding="utf-8"))
    feelings = meta["feelings"]
    tiers = json.loads(TIERS.read_text(encoding="utf-8"))
    names = tiers["tiers"]["reportable"]
    truth = load_truth("answer_key", feelings)

    pa, ta = load_system(args.a)
    pb, tb = load_system(args.b)
    if set(pa) != set(pb):
        sys.exit(f"{args.a} and {args.b} predict different reviews, so a "
                 f"paired comparison is not possible.")

    fa = f1s(truth, pa, ta, feelings, names)
    fb = f1s(truth, pb, tb, feelings, names)

    print(f"{'feeling':<16}{args.a[:13]:>14}{args.b[:13]:>14}")
    print("-" * 44)
    for f in names:
        print(f"{f:<16}{fa[f]['f1']:>14.3f}{fb[f]['f1']:>14.3f}")
    print("-" * 44)
    print(f"{'macro-F1':<16}{macro_f1(fa, names):>14.3f}"
          f"{macro_f1(fb, names):>14.3f}")
    print(f"\n{args.b} higher on {sum(fb[f]['f1'] > fa[f]['f1'] for f in names)}, "
          f"lower on {sum(fb[f]['f1'] < fa[f]['f1'] for f in names)}, "
          f"tied on {sum(fb[f]['f1'] == fa[f]['f1'] for f in names)}")

    ids = set(pa) & set(truth)
    films = films_of(ids)
    order = list(films)
    rng = random.Random(SEED)
    diffs = []
    for _ in range(ROUNDS):
        t, a, b = {}, {}, {}
        # Keyed by draw, so a film drawn twice counts twice.
        for k, film in enumerate(rng.choices(order, k=len(order))):
            for rid in films[film]:
                key = f"{k}:{rid}"
                t[key], a[key], b[key] = truth[rid], pa[rid], pb[rid]
        diffs.append(macro_f1(f1s(t, b, tb, feelings, names), names)
                     - macro_f1(f1s(t, a, ta, feelings, names), names))
    diffs.sort()

    print(f"\n{args.b} minus {args.a}, {ROUNDS} film-level resamples "
          f"({len(order)} films, {len(ids)} reviews):")
    print(f"  mean {sum(diffs) / ROUNDS:+.3f}, 95% range "
          f"[{diffs[int(.025 * ROUNDS)]:+.3f}, {diffs[int(.975 * ROUNDS)]:+.3f}]")
    print(f"  at or below 0 in {sum(d <= 0 for d in diffs)} of {ROUNDS}")


if __name__ == "__main__":
    main()
