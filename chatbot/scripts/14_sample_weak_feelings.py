#!/usr/bin/env python3
"""Step 14 - sample more reviews for the team to hand-label, aimed at the
feelings the model scores worst on.

The model is weakest on confused, thrilled, nostalgic, joyful and moved, and
these have few training examples. Random sampling would mostly return
reviews with none of them (60% of training reviews have no feeling at all),
so this step searches for wording that often goes with each one ("edge of my
seat", "takes me back", "mind-bending") and samples from the matches.

A match is only a candidate. The labeller reads the review and marks every
feeling it shows, by docs/labeling-guide.md, or none. A review that says
"childhood" without feeling nostalgic is a useful no for the model. The
labellers are not told which feeling a review was picked for, so the search
cannot steer their marks; more_manifest.json records it for us.

Three rules carry over from step 5:
  - only the `unsup` split, 300 to 3,000 characters;
  - no film from the checking set, the exam set or the answer-key reserve,
    so the new labels can only ever train the model, never grade it;
  - no review that is already labelled or was assigned before.
At most one review per film, so one film's reviews can't dominate a feeling.

Deterministic: the same SEED gives the same sample.

Run:  python scripts/14_sample_weak_feelings.py
      python scripts/14_sample_weak_feelings.py --per-feeling 40
Out:  data/labeling/batch_more_<name>.csv  (one per labeller; gitignored, has review text)
      data/labeling/more_manifest.json      (ids, the feeling each was picked for)
"""
import argparse
import csv
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # chatbot/
DATA = ROOT / "data"
REVIEWS = DATA / "reviews.jsonl"
FILMS = DATA / "films_starter.json"
OUTDIR = DATA / "labeling"
MANIFEST = OUTDIR / "manifest.json"
FEELINGS_MD = ROOT / "docs" / "feelings-list.md"
SEED = 49900
MIN_CHARS, MAX_CHARS = 300, 3000                   # same as step 5

# Wording that often goes with each feeling. Kept loose on purpose: the
# labeller decides, so a miss costs one review of their time, while a pattern
# that is too strict would only find the obvious cases.
TARGETS = {
    "confused": r"mind[- ]?(bending|boggling|blowing|f\w*)|what (was|is) real|"
                r"didn'?t know what was (going on|happening|real)|"
                r"kept me guessing|head[- ]?scratch\w*|baffl\w+|bewilder\w*|"
                r"disorient\w*|puzzl\w+|(?<!to be )confus(ed|ing)|surreal|dreamlike",
    "thrilled": r"edge of (my|your|the) seat|adrenaline|(heart|pulse)[- ]?pounding|"
                r"breathless|exhilarat\w+|thrill(ed|ing)|nail[- ]?biting|"
                r"white[- ]?knuckle|roller ?coaster|gripping|non[- ]?stop action",
    "nostalgic": r"nostalgi\w+|childhood|when i was (a kid|a child|young|little|\d+)|"
                 r"growing up|as a (kid|child|teen)|brings? back (memories|the)|"
                 r"takes? me back|memories of|good old days|those days",
    "joyful": r"pure joy|joy(ful|ous)|delight(ed|ful)|big smile|grinn(ing|ed)|"
              r"so happy|made me happy|feel[- ]?good|beaming|giddy|"
              r"smil(e|ing) on my face|put a smile",
    "moved": r"moved me|(so|deeply|very|truly) moving|touched me|brought (me to )?tears|"
             r"tears (in|to) my eyes|i cried|teared up|lump in my throat|"
             r"choked up|tear[- ]?jerker|tissues|cried (like|my)",
}


def parse_feelings(path):
    """The 28 label columns, in the order the frozen list gives them."""
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
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 3 and cells[0].lower() != "feeling" and not set(cells[0]) <= set("-: "):
            names.append(cells[0])
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labelers", default="roger,mate,apurba")
    ap.add_argument("--per-feeling", type=int, default=30)
    args = ap.parse_args()
    for p in (REVIEWS, FILMS, MANIFEST, FEELINGS_MD):
        if not p.exists():
            sys.exit(f"{p} not found.")
    feelings = parse_feelings(FEELINGS_MD)
    if len(feelings) != 28:
        sys.exit(f"parsed {len(feelings)} feelings, expected 28.")
    labelers = [n.strip() for n in args.labelers.split(",") if n.strip()]

    # Films that grade the model, and reviews already labelled or handed out.
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    blocked_films = set(man["films_reserved"])
    used = {i for ids in man["assignments"].values() for i in ids}
    for split in ("learning", "checking", "exam"):
        path = DATA / f"{split}.csv"
        if not path.exists():
            sys.exit(f"{path} not found; it is needed to skip labelled reviews.")
        for r in csv.DictReader(open(path, encoding="utf-8")):
            used.add(r["id"])
            if split != "learning":
                blocked_films.add(r["imdb_id"])

    titles = {f["imdb_id"]: (f["title"], f.get("year") or "")
              for f in json.load(open(FILMS, encoding="utf-8"))}
    patterns = {f: re.compile(rx, re.I) for f, rx in TARGETS.items()}

    matches = {f: [] for f in TARGETS}
    pool = 0
    for line in open(REVIEWS, encoding="utf-8"):
        r = json.loads(line)
        if (r["polarity"] != "unsup" or r["review_id"] in used
                or r["imdb_id"] in blocked_films
                or not MIN_CHARS <= len(r["text"]) <= MAX_CHARS):
            continue
        pool += 1
        for f, rx in patterns.items():
            if rx.search(r["text"]):
                matches[f].append(r)
    print(f"eligible reviews: {pool:,}")

    # Rarest matches first, so a review that fits two feelings goes to the
    # one with fewer candidates. One review per film across the whole sample.
    rng = random.Random(SEED)
    picked, films_taken = [], set()
    for f in sorted(TARGETS, key=lambda f: len(matches[f])):
        cands = sorted(matches[f], key=lambda r: r["review_id"])
        rng.shuffle(cands)
        n = 0
        for r in cands:
            if n == args.per_feeling:
                break
            if r["imdb_id"] in films_taken or any(p["review_id"] == r["review_id"] for p, _ in picked):
                continue
            picked.append((r, f))
            films_taken.add(r["imdb_id"])
            n += 1
        print(f"  {f:<10} {len(matches[f]):>5} matches -> {n} picked")
        if n < args.per_feeling:
            print(f"    only {n} usable for {f}")

    rng.shuffle(picked)            # mix the feelings so no block gives it away
    assigned = {n: [] for n in labelers}
    for i, item in enumerate(picked):
        assigned[labelers[i % len(labelers)]].append(item)

    header = ["id", "film", "year", "review", "labeler"] + feelings + ["notes"]
    for name, rows in assigned.items():
        out = OUTDIR / f"batch_more_{name}.csv"
        with open(out, "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(header)
            for r, _ in rows:
                title, year = titles.get(r["imdb_id"], ("", ""))
                w.writerow([r["review_id"], title, year, r["text"], name]
                           + [""] * len(feelings) + [""])
        print(f"  {out.name:<26} {len(rows)} reviews")

    (OUTDIR / "more_manifest.json").write_text(json.dumps({
        "seed": SEED,
        "purpose": "train",
        "note": ("Extra hand labels for training only. Every film here is outside "
                 "the checking and exam sets. 'picked_for' is the search that "
                 "found the review; labellers are not shown it."),
        "per_feeling": args.per_feeling,
        "patterns": TARGETS,
        "reviews": [{"id": r["review_id"], "imdb_id": r["imdb_id"],
                     "picked_for": f} for r, f in picked],
        "assignments": {n: [r["review_id"] for r, _ in rs] for n, rs in assigned.items()},
    }, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(picked)} reviews; ids and searches in more_manifest.json")


if __name__ == "__main__":
    main()
