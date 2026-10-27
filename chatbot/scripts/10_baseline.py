#!/usr/bin/env python3
"""Step 10 - the bag-of-words baseline the fine-tuned model has to beat.

TF-IDF plus one-vs-rest logistic regression: one independent binary
classifier per feeling, which is the same shape as 28 sigmoid heads, just
without the language model. Maas et al. (2011) used bag-of-words on this
dataset, so this is the honest comparison point rather than a strawman.

It matters that this runs first. With 2,643 training reviews and under 50
positives for most feelings, a linear model on n-grams is genuinely
competitive, and "we fine-tuned a transformer" is not a result until there is
something to compare it against. If the transformer does not beat this, that
is a finding worth reporting, not a failure to hide.

class_weight='balanced' is doing heavy lifting: `amused` has 507 positives
and `confused` 6, so unweighted fitting would learn to always say no.

Writes probabilities, not decisions - eval/score.py owns thresholding, and
tunes per feeling on val.

Run:  python scripts/10_baseline.py
Out:  eval/preds/baseline_{val,answer_key}.jsonl
"""
import json
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parent.parent          # chatbot/
TRAIN = ROOT / "data" / "training"
OUT = ROOT / "eval" / "preds"
SEED = 49900                                           # same seed as sampling


def load(split):
    rows = [json.loads(l) for l in
            open(TRAIN / f"{split}.jsonl", encoding="utf-8")]
    return ([r["id"] for r in rows], [r["text"] for r in rows],
            np.array([r["labels"] for r in rows]))


def main():
    meta = json.loads((TRAIN / "meta.json").read_text(encoding="utf-8"))
    feelings = meta["feelings"]

    tr_ids, tr_x, tr_y = load("train")
    print(f"train {len(tr_x)} reviews, {int(tr_y.sum())} marks")

    # Word 1-2 grams. min_df=2 drops hapaxes, which on 2,643 documents is most
    # of the vocabulary and all of the noise.
    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_df=0.9,
                          sublinear_tf=True, strip_accents="unicode",
                          lowercase=True)
    Xtr = vec.fit_transform(tr_x)
    print(f"features: {Xtr.shape[1]:,} tf-idf terms\n")

    models, skipped = {}, []
    for i, f in enumerate(feelings):
        y = tr_y[:, i]
        # A feeling with one class present cannot be fitted. Record it and
        # emit probability 0 later, rather than crashing or faking a model.
        if len(set(y)) < 2:
            skipped.append(f)
            continue
        m = LogisticRegression(max_iter=2000, class_weight="balanced",
                               C=1.0, random_state=SEED)
        m.fit(Xtr, y)
        models[f] = m
    print(f"fitted {len(models)} of 28 feelings")
    if skipped:
        print(f"unfittable (one class only): {', '.join(skipped)}")

    OUT.mkdir(parents=True, exist_ok=True)
    for split in ("val", "answer_key"):
        ids, xs, ys = load(split)
        X = vec.transform(xs)
        scores = np.zeros((len(ids), len(feelings)))
        for i, f in enumerate(feelings):
            if f in models:
                scores[:, i] = models[f].predict_proba(X)[:, 1]
        dst = OUT / f"baseline_{split}.jsonl"
        with open(dst, "w", encoding="utf-8") as fh:
            for rid, row in zip(ids, scores):
                fh.write(json.dumps({"id": rid,
                                     "scores": [round(float(v), 5) for v in row]}) + "\n")
        print(f"{split:<11} {len(ids):>4} reviews -> {dst.relative_to(ROOT)}")

    print("\nNext:")
    print("  python eval/score.py eval/preds/baseline_val.jsonl --tune "
          "--out eval/thresholds_baseline.json")
    print("  python eval/score.py eval/preds/baseline_answer_key.jsonl "
          "--thresholds eval/thresholds_baseline.json")


if __name__ == "__main__":
    main()
