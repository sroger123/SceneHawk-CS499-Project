#!/usr/bin/env python3
"""Scores on each part of the answer key, split by where its labels came from.

The answer key joins two groups. The team's hand labels also tuned the labelling
prompt during the pilot, so an LLM given that prompt may do better on them than
it otherwise would. The spot-check reviews played no part in the pilot.

Macro-F1 is noisy here, with few positives per feeling in each group, so micro-F1
over the same feelings is printed next to it. Fits nothing and writes nothing.

Run:  python eval/by_source.py baseline distilroberta gpt55
"""
import argparse
import json
from pathlib import Path

from compare import f1s, load_system
from score import (TIERS, TRAIN_DIR, confusion, load_truth, macro_f1)

HERE = Path(__file__).resolve().parent
MANIFEST = HERE.parent / "data" / "labeling" / "manifest.json"


def hand_labelled():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {rid for ids in manifest["assignments"].values() for rid in ids}


def scores(truth, preds, thr, feelings, names):
    macro = macro_f1(f1s(truth, preds, thr, feelings, names), names)
    tp = fp = fn = 0
    for f in names:
        a, b, c = confusion(truth, preds, feelings.index(f), thr[f])[:3]
        tp, fp, fn = tp + a, fp + b, fn + c
    return macro, 2 * tp / max(2 * tp + fp + fn, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("systems", nargs="+", help="e.g. baseline distilroberta gpt55")
    args = ap.parse_args()

    meta = json.loads((TRAIN_DIR / "meta.json").read_text(encoding="utf-8"))
    feelings = meta["feelings"]
    names = json.loads(TIERS.read_text(encoding="utf-8"))["tiers"]["reportable"]
    truth = load_truth("answer_key", feelings)
    hand = hand_labelled()

    print(f"{'system':<16}{'group':<14}{'reviews':>8}{'macro-F1':>10}{'micro-F1':>10}")
    for name in args.systems:
        preds, thr = load_system(name)
        ids = set(preds) & set(truth)
        for group, keep in (("all", ids), ("hand", ids & hand),
                            ("spot-check", ids - hand)):
            macro, micro = scores({k: truth[k] for k in keep},
                                  {k: preds[k] for k in keep},
                                  thr, feelings, names)
            print(f"{name:<16}{group:<14}{len(keep):>8}{macro:>10.3f}{micro:>10.3f}")


if __name__ == "__main__":
    main()
