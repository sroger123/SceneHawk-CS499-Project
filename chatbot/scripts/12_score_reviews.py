#!/usr/bin/env python3
"""Step 12 - fill the feelings table (film_feelings) with the trained model.

Runs the saved feelings model over every review, averages the 28 scores per
film, and writes one row per (film, feeling):

    score               mean predicted probability over the film's reviews
    review_count        how many reviews went into the mean
    evidence_review_id  the review the model scored highest for that feeling
    model_version       the model folder's name, so every score is traceable

The model needs a GPU to finish in reasonable time (about 15 minutes on a
Colab T4 for ~37k reviews; hours on a laptop CPU). See notebooks/
fill_feelings_table.ipynb for the Colab version of this exact command.

Reviews come from Supabase (the reviews table) or, with --reviews, from
data/reviews.jsonl. Per-review scores are cached as they are made, so a run
that stops can be restarted and picks up where it left off.

Run:
  python scripts/12_score_reviews.py --model <saved model folder>             # score + write
  python scripts/12_score_reviews.py --model <folder> --dry-run               # score, no DB writes
  python scripts/12_score_reviews.py --model <folder> --reviews data/reviews.jsonl --limit 200

Needs: torch, transformers, numpy, psycopg2-binary, python-dotenv, and
SUPABASE_DB_URL in chatbot/.env (or the environment) unless --dry-run.
"""
import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
META = ROOT / "data" / "training" / "meta.json"
OUT_DIR = ROOT / "data" / "feelings"
MAX_LEN = 512                                     # same as training


def load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env")
    except ImportError:
        pass


def connect():
    import psycopg2
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("SUPABASE_DB_URL is not set (chatbot/.env or the environment).")
    return psycopg2.connect(url)


def read_reviews(args):
    """Yield (review_id, tmdb_id, text)."""
    if args.reviews:
        with open(args.reviews, encoding="utf-8") as fh:
            for line in fh:
                r = json.loads(line)
                yield r["review_id"], int(r["tmdb_id"]), r["text"]
        return
    conn = connect()
    with conn, conn.cursor(name="reviews") as cur:      # server-side cursor
        cur.itersize = 2000
        cur.execute("select review_id, tmdb_id, text from reviews order by review_id")
        for row in cur:
            yield row[0], int(row[1]), row[2]
    conn.close()


def load_model(path):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tok = AutoTokenizer.from_pretrained(path)
    model = AutoModelForSequenceClassification.from_pretrained(path)
    labels = [model.config.id2label[i] for i in range(model.config.num_labels)]

    # The saved model carries its own output order. It has to match the
    # frozen list, or column 7 would land in the wrong feeling.
    expected = json.loads(META.read_text(encoding="utf-8"))["feelings"]
    if labels != expected:
        sys.exit(f"model's feeling order does not match {META}:\n{labels}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()
    return tok, model, labels, device


def read_settings(path):
    """How the model was trained to cut long reviews, from the
    scenehawk_settings.json the training notebook saves with it. Models saved
    before that file existed (v1) were trained on the first MAX_LEN tokens."""
    s = {"max_len": MAX_LEN, "truncation": "head", "head": None}
    f = Path(path) / "scenehawk_settings.json"
    if f.exists():
        s.update(json.loads(f.read_text(encoding="utf-8")))
    if s["truncation"] not in ("head", "head_tail") or (
            s["truncation"] == "head_tail" and not 0 < s["head"] < s["max_len"]):
        sys.exit(f"{f}: unknown truncation settings {s}")
    return s


def encode(tok, texts, settings):
    """Cut reviews exactly as in training (notebooks/train_feelings.ipynb)."""
    m = settings["max_len"]
    if settings["truncation"] == "head":
        return tok(texts, truncation=True, max_length=m, padding=True,
                   return_tensors="pt")
    h = settings["head"]
    ids = [x if len(x) <= m else x[:h] + x[-(m - h):]
           for x in tok(texts)["input_ids"]]
    return tok.pad([{"input_ids": x, "attention_mask": [1] * len(x)} for x in ids],
                   return_tensors="pt")


def score_batches(tok, model, device, rows, batch, settings):
    import torch
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        enc = encode(tok, [r[2] for r in chunk], settings).to(device)
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.float16,
                                             enabled=device == "cuda"):
            logits = model(**enc).logits
        probs = torch.sigmoid(logits.float()).cpu().numpy()
        yield chunk, probs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--model", required=True, help="saved model folder (has config.json)")
    ap.add_argument("--version", help="model_version to store (default: the folder name)")
    ap.add_argument("--reviews", help="read reviews from this JSONL instead of Supabase")
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--limit", type=int, help="score only the first N reviews (testing)")
    ap.add_argument("--min-reviews", type=int, default=1,
                    help="skip films with fewer scored reviews than this")
    ap.add_argument("--dry-run", action="store_true", help="score and save files, no DB writes")
    args = ap.parse_args()
    load_env()

    version = args.version or Path(args.model).resolve().name
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = OUT_DIR / f"review_scores_{version}.jsonl"

    tok, model, feelings, device = load_model(args.model)
    settings = read_settings(args.model)
    print(f"model {version} on {device}, {len(feelings)} feelings, "
          f"reviews cut by {settings['truncation']} at {settings['max_len']} tokens")

    # ---- 1. score every review not already in the cache -------------------
    done = {}
    if cache.exists():
        with open(cache, encoding="utf-8") as fh:
            for line in fh:
                r = json.loads(line)
                done[r["id"]] = r
        print(f"resuming: {len(done)} reviews already scored in {cache.name}")

    rows = [r for r in read_reviews(args) if r[0] not in done]
    if args.limit:
        rows = rows[:max(0, args.limit - len(done))]
    # Similar lengths in a batch means less padding: noticeably faster.
    rows.sort(key=lambda r: len(r[2]))
    print(f"to score: {len(rows)} reviews")

    t0, n = time.time(), 0
    with open(cache, "a", encoding="utf-8") as fh:
        for chunk, probs in score_batches(tok, model, device, rows, args.batch, settings):
            for (rid, tmdb, _), p in zip(chunk, probs):
                rec = {"id": rid, "tmdb_id": tmdb, "scores": [round(float(v), 5) for v in p]}
                fh.write(json.dumps(rec) + "\n")
                done[rid] = rec
            n += len(chunk)
            if n % (args.batch * 50) < args.batch:
                rate = n / max(time.time() - t0, 1e-6)
                print(f"  {n}/{len(rows)} reviews, {rate:.0f}/s")
            fh.flush()
    print(f"scored {n} new reviews in {time.time() - t0:.0f}s")

    # ---- 2. average per film, keep the strongest review per feeling -------
    by_film = defaultdict(list)
    for r in done.values():
        by_film[r["tmdb_id"]].append(r)

    out_rows = []
    for tmdb, revs in by_film.items():
        if len(revs) < args.min_reviews:
            continue
        m = np.array([r["scores"] for r in revs], dtype=np.float32)
        mean, best = m.mean(axis=0), m.argmax(axis=0)
        for j, feeling in enumerate(feelings):
            out_rows.append((tmdb, feeling, round(float(mean[j]), 5), len(revs),
                             revs[int(best[j])]["id"], version))

    table = OUT_DIR / f"film_feelings_{version}.jsonl"
    with open(table, "w", encoding="utf-8") as fh:
        keys = ("tmdb_id", "feeling", "score", "review_count", "evidence_review_id", "model_version")
        for row in out_rows:
            fh.write(json.dumps(dict(zip(keys, row))) + "\n")
    print(f"{len(by_film)} films -> {len(out_rows)} rows, saved to {table}")

    # A quick look at whether the scores make sense.
    top = defaultdict(list)
    for tmdb, feeling, score, *_ in out_rows:
        top[feeling].append((score, tmdb))
    for f in ("tense", "amused", "sad", "cozy"):
        if top[f]:
            best3 = sorted(top[f], reverse=True)[:3]
            print(f"  top {f}: " + ", ".join(f"{t} ({s:.2f})" for s, t in best3))

    if args.dry_run:
        print("dry run: nothing written to Supabase")
        return

    # ---- 3. write film_feelings -------------------------------------------
    from psycopg2.extras import execute_values
    conn = connect()
    with conn, conn.cursor() as cur:
        # Films the model scored get a fresh set of rows. Films it did not
        # score (e.g. a --limit run) keep whatever they had.
        cur.execute("delete from film_feelings where tmdb_id = any(%s)",
                    (list({r[0] for r in out_rows}),))
        execute_values(cur, """
            insert into film_feelings
                (tmdb_id, feeling, score, review_count, evidence_review_id, model_version)
            values %s""", out_rows, page_size=2000)
        cur.execute("select count(distinct tmdb_id), count(*) from film_feelings")
        films, total = cur.fetchone()
    conn.close()
    print(f"film_feelings now holds {total} rows for {films} films")


if __name__ == "__main__":
    main()
