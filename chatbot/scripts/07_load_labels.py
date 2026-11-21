#!/usr/bin/env python3
"""Step 7 - load the labelled splits into review_labels and stamp label_split.

The CSVs are wide (one row per review, 28 columns of 0/1); review_labels is
long (one row per feeling that is actually present). A 0 produces nothing -
absence is recorded by the row not existing, which is what the schema means by
"A review with no feelings simply has no rows here. That is a valid label."

  learning.csv -> label_split 'train'       source 'llm'    labeler 'deepseek'
  checking.csv -> label_split 'val'         source 'llm'    labeler 'deepseek'
  exam.csv     -> label_split 'answer_key'  source 'human'  labeler 'team'
                  for the reviews the team labelled (data/labeling/manifest.json)
               -> label_split 'spot_check'  source 'llm'    labeler 'deepseek_hand_checked'
                  for the rest

The spot-check rows started as DeepSeek's labels and were then hand checked, so
they are kept apart from the team's. Neither split is ever trained on.

learning.csv also holds 150 reviews hand labelled by roger on 11/21 (listed in
data/labeling/more_manifest.json). Those load as source 'human', labeler
'roger', still in the 'train' split.

Run db/migrations/2026-11-02_spot_check_split.sql once on a database created
before that split existed. Run 04_load_supabase.py first (films and reviews must
exist), and 06_expand_films.py before that (the splits reference films the
starter set does not have). Labels whose review is missing are skipped and
counted.

Safe to re-run: every insert upserts on (review_id, feeling, labeler), so a
corrected CSV updates rather than duplicating.

Needs SUPABASE_DB_URL in chatbot/.env

Run:  python scripts/07_load_labels.py
      python scripts/07_load_labels.py --dry-run
"""
import argparse
import csv
import json
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
load_dotenv(ROOT / ".env")

REVIEWS = ROOT / "data" / "reviews.jsonl"
FEELINGS_MD = ROOT / "docs" / "feelings-list.md"
MANIFEST = ROOT / "data" / "labeling" / "manifest.json"
BATCH = 1000

# file            label_split    source   labeler
SPLITS = [
    ("learning", "train",      "llm",   "deepseek"),
    ("checking", "val",        "llm",   "deepseek"),
    ("exam",     "answer_key", "human", "team"),
]
# exam.csv rows the team was not assigned
SPOT_CHECK = ("spot_check", "llm", "deepseek_hand_checked")
# learning.csv rows hand labelled from data/labeling/batch_more_all_labeled.csv
MORE_MANIFEST = ROOT / "data" / "labeling" / "more_manifest.json"
HAND_TRAIN = ("train", "human", "roger")
META = {"id", "imdb_id", "review", "film", "year", "labeler", "notes", "source"}


def parse_feelings(path):
    """The 28 names, straight from the frozen list, so a typo in a CSV header
    cannot quietly invent a feeling the database will reject."""
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="parse and count everything, write nothing")
    args = ap.parse_args()

    if not FEELINGS_MD.exists():
        sys.exit(f"{FEELINGS_MD} not found.")
    feelings = parse_feelings(FEELINGS_MD)
    if len(feelings) != 28:
        sys.exit(f"parsed {len(feelings)} feelings, expected 28.")
    valid = set(feelings)

    known = set()
    if REVIEWS.exists():
        for line in open(REVIEWS, encoding="utf-8"):
            known.add(json.loads(line)["review_id"])
    print(f"reviews available locally: {len(known):,}")
    print()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    team = {rid for ids in manifest["assignments"].values() for rid in ids}
    hand_train = set()
    if MORE_MANIFEST.exists():
        more = json.loads(MORE_MANIFEST.read_text(encoding="utf-8"))
        hand_train = {r["id"] for r in more["reviews"]}

    labels, splits, spot_ids, missing_total = [], [], [], 0
    for name, split, source, labeler in SPLITS:
        p = ROOT / "data" / f"{name}.csv"
        if not p.exists():
            sys.exit(f"{p} not found.")
        rows = list(csv.DictReader(open(p, encoding="utf-8")))
        cols = [c for c in rows[0] if c not in META]
        unknown = [c for c in cols if c not in valid]
        if unknown:
            sys.exit(f"{name}.csv has columns that are not feelings: {unknown}")

        marks = present = missing = spot_marks = 0
        for r in rows:
            if r["id"] not in known:
                missing += 1
                continue
            present += 1
            spot = name == "exam" and r["id"] not in team
            hand = name == "learning" and r["id"] in hand_train
            row_split, row_source, row_labeler = (
                SPOT_CHECK if spot else HAND_TRAIN if hand
                else (split, source, labeler))
            if spot:
                spot_ids.append(r["id"])
            splits.append((r["id"], row_split))
            for f in cols:
                if str(r[f]).strip() == "1":
                    labels.append((r["id"], f, row_labeler, row_source))
                    marks += 1
                    spot_marks += spot
        missing_total += missing
        print(f"{name + '.csv':<14} {len(rows):>5} rows -> {split:<11} "
              f"{source:<6} | {marks - spot_marks:>5} labels | {missing:>5} reviews missing")
        if name == "exam":
            print(f"{'':<14} {len(spot_ids):>5} of them -> {SPOT_CHECK[0]:<11} "
                  f"{SPOT_CHECK[1]:<6} | {spot_marks:>5} labels")

    print()
    print(f"total: {len(labels):,} label rows, {len(splits):,} reviews to stamp")
    if missing_total:
        print(f"WARNING: {missing_total:,} reviews are not in reviews.jsonl - "
              f"run scripts/06_expand_films.py first or their labels are lost.")

    if args.dry_run:
        print("\n--- dry run, nothing written ---")
        for row in labels[:5]:
            print("  ", row)
        return

    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("SUPABASE_DB_URL is not set (put it in chatbot/.env).")

    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    # 1. the labels themselves. Spot-check rows once loaded as the team's, and
    #    labeler is in the primary key, so the old rows have to go.
    cur.execute("delete from review_labels where labeler = 'team' "
                "and review_id = any(%s)", (spot_ids,))
    print(f"\nreview_labels: {cur.rowcount:,} stale team rows removed")
    execute_values(cur, """
        insert into review_labels (review_id, feeling, labeler, source)
        values %s
        on conflict (review_id, feeling, labeler) do update
            set source = excluded.source
    """, labels, page_size=BATCH)
    print(f"review_labels: {len(labels):,} rows written")

    # 2. stamp each review with the split it belongs to. This is the guard
    #    rail: once the answer key is marked, a training query that forgets to
    #    exclude it is one SQL check away from being caught.
    execute_values(cur, """
        update reviews r set label_split = v.split
        from (values %s) as v(review_id, split)
        where r.review_id = v.review_id
    """, splits, page_size=BATCH)
    print(f"reviews.label_split: {cur.rowcount:,} rows stamped")

    conn.commit()

    cur.execute("""
        select label_split, count(*) from reviews group by 1 order by 2 desc
    """)
    print("\nlabel_split in the database:")
    for split, n in cur.fetchall():
        print(f"  {split:<12} {n:,}")

    cur.execute("""
        select count(*) from review_labels l
          join reviews r using (review_id)
         where r.label_split = 'answer_key' and l.source = 'llm'
    """)
    leaked = cur.fetchone()[0]
    print(f"\nanswer-key rows carrying llm labels: {leaked}  (expect 0)")

    cur.close()
    conn.close()
    print("\ncommitted.")


if __name__ == "__main__":
    main()
