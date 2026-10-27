#!/usr/bin/env python3
"""Score a feelings model against the answer key, honestly.

Two rules this enforces so nobody has to remember them under deadline:

  1. The headline number is macro-F1 over the `reportable` tier only
     (eval/metric_tiers.py). Feelings with no answer-key positives have
     recall 0/0 - undefined, not zero - so there is no F1 to average in.
     Including them would silently drag the macro number toward 0 and make a
     labelling limit look like a model failure.

  2. Thresholds are tuned on `val`, never on the answer key. With base rates
     this low a flat 0.5 predicts almost nothing, so per-feeling thresholds
     are necessary - which makes them a knob, which means they must be fitted
     off the test set. Tune once on val, freeze, then score.

Predictions are JSONL: {"id": "...", "scores": [28 floats in meta.json order]}

Run:  python eval/score.py preds_val.jsonl --tune --out eval/thresholds.json
      python eval/score.py preds_answer_key.jsonl --thresholds eval/thresholds.json
Import:  from score import prf, macro_f1, tune_thresholds
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # chatbot/
HERE = Path(__file__).resolve().parent
TRAIN_DIR = ROOT / "data" / "training"
TIERS = HERE / "metric_tiers.json"


def prf(tp, fp, fn):
    """Precision, recall, F1.

    F1 is undefined in exactly one case: no gold positives exist, so recall is
    0/0. Predicting nothing is NOT that case - precision is undefined but
    recall is a real 0, and the model genuinely scored F1 0. Returning None
    there would be worse than wrong, because macro_f1 skips None and the
    feelings a model failed hardest on would quietly leave the average."""
    p = tp / (tp + fp) if (tp + fp) else None
    r = tp / (tp + fn) if (tp + fn) else None
    if r is None:
        return p, r, None            # nothing to find: undefined, not zero
    if p is None or p + r == 0:
        return p, r, 0.0             # found nothing, but there was something
    return p, r, 2 * p * r / (p + r)


def confusion(truth, preds, i, thr):
    """tp/fp/fn for feeling i at threshold thr, over ids present in both."""
    tp = fp = fn = 0
    for rid, labels in truth.items():
        s = preds.get(rid)
        if s is None:
            continue
        hit = s[i] >= thr
        gold = labels[i] == 1
        if hit and gold:
            tp += 1
        elif hit:
            fp += 1
        elif gold:
            fn += 1
    return tp, fp, fn


MIN_VAL_SUPPORT = 10    # positives needed before a feeling earns its own threshold


def tune_thresholds(truth, preds, feelings, grid=None, verbose=False):
    """Per-feeling thresholds where the data supports them, one global
    threshold everywhere else.

    Tuning every feeling independently looks obviously right and is a trap.
    With 6 positives in val, maximising F1 drives the threshold to the floor:
    recall 1.0 at precision 0.02 scores better than any honest cut, so the
    tuner learns "predict `uncomfortable` for all 206 reviews". That is a
    worthless recommender with a respectable-looking number, which is the
    worst combination available.

    So a feeling only earns its own threshold with at least MIN_VAL_SUPPORT
    positives to fit against. The rest share a global threshold chosen on
    pooled counts (micro-F1), which cannot collapse because one rare class
    cannot drag it. Ties break toward the higher threshold, preferring
    precision.
    """
    grid = grid or [i / 100 for i in range(5, 96, 5)]

    support = {f: sum(1 for labels in truth.values() if labels[i] == 1)
               for i, f in enumerate(feelings)}
    shared = [i for i, f in enumerate(feelings)
              if 0 < support[f] < MIN_VAL_SUPPORT]

    # The global threshold is fitted ONLY on the feelings that will use it.
    #
    # Pooling every feeling instead looks more principled and is biased: with
    # 84 of 287 val positives, `amused` dominates a micro-F1 pool and the
    # global threshold becomes amused's optimum. Rare feelings score far lower
    # probabilities, so that cut silences them completely - 0 true positives,
    # 0 false positives, F1 0. That understates the baseline, which flatters
    # whatever we compare against it. Exactly the error we just removed, with
    # the sign flipped.
    #
    # Averaging F1 across the low-support feelings keeps the threshold in
    # their range, and averaging over many of them means no single rare class
    # can collapse it the way per-feeling tuning did.
    best, global_thr = -1.0, 0.5
    for thr in grid:
        f1s = []
        for i in shared:
            _, _, f1 = prf(*confusion(truth, preds, i, thr))
            if f1 is not None:
                f1s.append(f1)
        if f1s and sum(f1s) / len(f1s) >= best:
            best, global_thr = sum(f1s) / len(f1s), thr

    out, own = {}, []
    for i, f in enumerate(feelings):
        if support[f] < MIN_VAL_SUPPORT:
            out[f] = global_thr
            continue
        b, bt = -1.0, global_thr
        for thr in grid:
            _, _, f1 = prf(*confusion(truth, preds, i, thr))
            if f1 is not None and f1 >= b:
                b, bt = f1, thr
        out[f] = bt
        own.append(f)

    if verbose:
        print(f"global threshold {global_thr:.2f} (mean F1 {best:.3f} over "
              f"the {len(shared)} low-support feelings it applies to)")
        print(f"own threshold: {len(own)} feelings with >= "
              f"{MIN_VAL_SUPPORT} val positives - {', '.join(own)}")
        print(f"global applied to the other {len(feelings) - len(own)}")
        print()
    return out


def load_jsonl(path, key):
    if not path.exists():
        sys.exit(f"{path} not found.")
    out = {}
    for line in open(path, encoding="utf-8"):
        row = json.loads(line)
        if key not in row:
            sys.exit(f"{path}: a row has no '{key}' field.")
        out[row["id"]] = row[key]
    return out


def macro_f1(scored, names):
    """Mean F1 over `names`, skipping any whose F1 is undefined."""
    vals = [scored[n]["f1"] for n in names
            if n in scored and scored[n]["f1"] is not None]
    return (sum(vals) / len(vals)) if vals else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("predictions", help="JSONL with id + scores")
    ap.add_argument("--split", default=None,
                    help="truth split; inferred from --tune if omitted")
    ap.add_argument("--tune", action="store_true",
                    help="fit per-feeling thresholds on this split (use val)")
    ap.add_argument("--thresholds", help="frozen thresholds from a --tune run")
    ap.add_argument("--out", help="where to write tuned thresholds")
    args = ap.parse_args()

    split = args.split or ("val" if args.tune else "answer_key")
    if args.tune and split == "answer_key":
        sys.exit("Refusing to tune thresholds on the answer key. Use --split val.")

    meta = json.loads((TRAIN_DIR / "meta.json").read_text(encoding="utf-8"))
    feelings = meta["feelings"]
    tiers = json.loads(TIERS.read_text(encoding="utf-8"))
    reportable = tiers["tiers"]["reportable"]
    wide = set(tiers.get("wide_confidence", []))

    truth = load_jsonl(TRAIN_DIR / f"{split}.jsonl", "labels")
    preds = load_jsonl(Path(args.predictions), "scores")
    overlap = set(truth) & set(preds)
    if not overlap:
        sys.exit("No ids in common between predictions and truth.")
    print(f"split {split}: {len(truth)} reviews, "
          f"{len(overlap)} with predictions\n")

    if args.tune:
        thr = tune_thresholds(truth, preds, feelings, verbose=True)
    elif args.thresholds:
        thr = json.loads(Path(args.thresholds).read_text(encoding="utf-8"))
    else:
        thr = {f: 0.5 for f in feelings}
        print("no --thresholds given, using a flat 0.5 "
              "(expect near-zero recall at these base rates)\n")

    scored = {}
    for i, f in enumerate(feelings):
        tp, fp, fn = confusion(truth, preds, i, thr.get(f, 0.5))
        p, r, f1 = prf(tp, fp, fn)
        scored[f] = {"threshold": thr.get(f, 0.5), "support": tp + fn,
                     "tp": tp, "fp": fp, "precision": p, "recall": r, "f1": f1}

    def fmt(v):
        return " n/a " if v is None else f"{v:.3f}"

    print(f"{'feeling':<16}{'thr':>5}{'sup':>5}{'tp':>4}{'fp':>4}"
          f"{'prec':>7}{'rec':>7}{'F1':>7}")
    print("-" * 61)
    for f in reportable:
        s = scored[f]
        star = " *" if f in wide else ""
        print(f"{f:<16}{s['threshold']:>5.2f}{s['support']:>5}{s['tp']:>4}"
              f"{s['fp']:>4}{fmt(s['precision']):>7}{fmt(s['recall']):>7}"
              f"{fmt(s['f1']):>7}{star}")
    print("-" * 61)

    head = macro_f1(scored, reportable)
    print(f"\nmacro-F1 over the {len(reportable)} reportable feelings: "
          f"{fmt(head)}")
    print("  ^ cite it with that qualifier, never as bare macro-F1")
    all28 = macro_f1(scored, feelings)
    print(f"\nfor contrast, over all 28 (do not headline this): {fmt(all28)}")
    excluded = [f for t in ("trainable_only", "unmeasurable", "cannot_learn")
                for f in tiers["tiers"].get(t, [])]
    print(f"  the {len(excluded)} excluded: {', '.join(excluded)}")
    if wide & set(reportable):
        print(f"\n* {len(wide & set(reportable))} reportable feelings have few "
              f"answer-key positives; their F1 swings on one or two reviews.")

    if args.out:
        Path(args.out).write_text(json.dumps(thr, indent=2) + "\n")
        print(f"\nthresholds written to {args.out}")


if __name__ == "__main__":
    main()
