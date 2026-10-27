# Data pipeline

Builds the film + review corpus the feelings model trains on, and loads it
into Supabase.

## Why this source

TMDB reviews are too sparse: in an 80-film sample, the median film had **1** review and
**no film** had 20 or more. The Large Movie Review Dataset (aclImdb) holds 100,000 reviews
capped at 30 per film, which gives **1,391 films with >= 20 reviews**.

## Before you start

1. Download and extract the dataset into `chatbot/data/external/`:
   <https://ai.stanford.edu/~amaas/data/sentiment/aclImdb_v1.tar.gz> (~81 MB)
   You should end up with `chatbot/data/external/aclImdb/`.
2. Put `TMDB_API_KEY` in `chatbot/.env`. For step 4, add `SUPABASE_DB_URL`
   too (see `.env.example`), and run `db/schema.sql` in the Supabase SQL
   editor first so the tables exist.
3. `pip install -r requirements.txt`

## Run, in order

```bash
cd chatbot
python scripts/01_count_reviews.py     # how many reviews per film  -> review_counts.json
python scripts/02_build_starter.py     # pick films + TMDB metadata -> films_starter.json
python scripts/03_extract_reviews.py   # clean review text          -> reviews.jsonl
python scripts/04_load_supabase.py     # load it all into Supabase
```

## Week 3 - labelling and the splits

```bash
python scripts/05_sample_for_labeling.py   # pick reviews to hand-label
# ... hand labelling, then LLM labelling in notebooks/scenehawk_llm_labeling.ipynb
python scripts/06_expand_films.py          # add the films the splits need
python scripts/04_load_supabase.py         # reload the grown corpus
python scripts/07_load_labels.py           # labels -> review_labels, stamp label_split
python scripts/08_export_labels.py         # text-free copies for git
```

Step 6 exists because the learning/checking/exam splits were sampled from the
whole aclImdb corpus, not the 1,259-film starter set, so most of the films they
reference have no row yet and the labels would fail on the foreign keys. It
deliberately ignores the 20-review threshold: that threshold protects film
profiles, not training, because the model reads one review at a time and never
sees how many reviews a film has. Apply it in Week 5 instead, on
`films.review_count`.

Step 7 turns the wide CSVs (28 columns of 0/1) into the long shape
`review_labels` wants (one row per feeling present). A 0 writes nothing -
absence is the row not existing. It maps:

| file | `label_split` | `source` | `labeler` |
|---|---|---|---|
| `learning.csv` | `train` | `llm` | `deepseek` |
| `checking.csv` | `val` | `llm` | `deepseek` |
| `exam.csv` | `answer_key` | `human` | `team` |

Step 8 writes `data/labels/*_labels.csv` - the same labels with the review text
dropped, 4.9 MB down to 313 KB. The full split files are gitignored because
they embed aclImdb text; these are what the repo keeps.

Step 2 makes one TMDB call per film (~1,400 calls, a few minutes).

Step 4 loads in foreign-key order - feelings, then films, then reviews - because
each table references the one before it. It is safe to re-run: every insert
upserts on its primary key, and it never touches `review_labels`, so a re-run
cannot destroy labelling work. Use `--dry-run` to parse and count without
writing anything.

The 28 feelings are parsed out of `docs/feelings-list.md` rather than retyped,
so that file stays the single source of truth. The script stops if it does not
find exactly 28.

## What you get

| Output | Contents |
|---|---|
| `data/films_starter.json` | 1,259 films with title, year, genres, description, review count |
| `data/reviews.jsonl` | 34,626 cleaned reviews, each linked to its film |
| Supabase `feelings` / `films` / `reviews` | the same data, queryable and shared with the team |

Median 30 reviews per film; median review length ~1,000 characters.

## Not in git

`data/external/` and `data/reviews.jsonl` are gitignored - the dataset should not be
redistributed. Regenerate them with the scripts above. `films_starter.json` is TMDB
metadata and is committed.

## Note for labelling

Roughly half the corpus is the `unsup` split, which contains reviews of **any** rating
including neutral. The `pos`/`neg` splits only hold strongly positive (>=7) or strongly
negative (<=4) reviews. **Sample from `unsup`** for a balanced spread of feelings.

## Which feelings the result can report on

`eval/metric_tiers.py` splits the 28 feelings by what the data supports, reading the
committed label files (no database needed). Re-run it after any labelling round.

| tier | meaning |
| --- | --- |
| `reportable` | >=3 answer-key examples. The headline macro-F1 covers these only. |
| `trainable_only` | 1-2 answer-key examples. Train on them, do not report an F1. |
| `unmeasurable` | no answer-key examples, so recall is 0/0 and F1 is undefined. |
| `cannot_learn` | no training examples either. |

Train on all 28 regardless: the heads are independent sigmoids, so an unused one costs
nothing, and removing a feeling from the label space is hard to undo later. The limit is
answer-key size, not labelling quality - `scared` has 48 training examples and 2 in the
answer key.

Always name the metric as "macro-F1 over the reportable tier", never bare "macro-F1".

## Citation

Maas, A. L., Daly, R. E., Pham, P. T., Huang, D., Ng, A. Y., & Potts, C. (2011).
*Learning Word Vectors for Sentiment Analysis.* ACL-HLT 2011, 142-150.
