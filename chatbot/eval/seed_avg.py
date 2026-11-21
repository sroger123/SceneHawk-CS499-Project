"""Average the per-feeling scores of several training runs (same model, different seeds).

Plain mean, equal weights: nothing is tuned, so the answer key cannot leak in.
Run from chatbot/:
  python eval/seed_avg.py OUT_DIR run1_val.jsonl run2_val.jsonl run3_val.jsonl
It writes OUT_DIR/seedavg_val.jsonl and, for each input, looks for the matching
*_answer_key* file next to it and writes OUT_DIR/seedavg_answer_key.jsonl too.
Then prints val mAP for each run and for the average.
"""
import json, sys
from pathlib import Path
import numpy as np
from sklearn.metrics import average_precision_score
sys.path.insert(0, "eval")
from score import load_truth, load_preds, TRAIN_DIR

out_dir, vals = Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]
assert len(vals) >= 2, "give at least two val prediction files"
feelings = json.loads((TRAIN_DIR / "meta.json").read_text(encoding="utf-8"))["feelings"]

def average(paths, dst):
    runs = [load_preds(p, feelings) for p in paths]
    ids = set(runs[0])
    assert all(set(r) == ids for r in runs), f"runs cover different reviews: {paths}"
    with open(dst, "w", encoding="utf-8") as fh:
        for i in sorted(ids):
            fh.write(json.dumps({"id": i, "scores": [round(float(x), 5) for x in np.mean([r[i] for r in runs], axis=0)]}) + "\n")

out_dir.mkdir(parents=True, exist_ok=True)
average(vals, out_dir / "seedavg_val.jsonl")
keys = [Path(str(p).replace("_val", "_answer_key")) for p in vals]
if all(k.exists() for k in keys):
    average(keys, out_dir / "seedavg_answer_key.jsonl")

truth = load_truth("val", feelings)
def val_map(p):
    preds = load_preds(p, feelings)
    ids = sorted(set(truth) & set(preds))
    Y = np.array([list(truth[i]) for i in ids]); S = np.array([list(preds[i]) for i in ids])
    has = [j for j in range(len(feelings)) if Y[:, j].sum() > 0]
    return np.mean([average_precision_score(Y[:, j], S[:, j]) for j in has])
for p in vals:
    print(f"{p.name:60s} val mAP {val_map(p):.4f}")
print(f"{'average of ' + str(len(vals)) + ' runs':60s} val mAP {val_map(out_dir / 'seedavg_val.jsonl'):.4f}")
