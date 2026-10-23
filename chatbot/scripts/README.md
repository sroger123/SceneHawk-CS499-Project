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

## Citation

Maas, A. L., Daly, R. E., Pham, P. T., Huang, D., Ng, A. Y., & Potts, C. (2011).
*Learning Word Vectors for Sentiment Analysis.* ACL-HLT 2011, 142-150.
