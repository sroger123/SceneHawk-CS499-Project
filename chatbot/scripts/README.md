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

## Week 4 - training data, baseline, scoring

    python scripts/09_build_training_data.py   # text + 28-wide label vector
    python scripts/10_baseline.py              # tf-idf + logistic regression

Label order comes from `docs/feelings-list.md`, the same parser step 7 uses, so
column 7 means the same feeling in training, in scoring and in the database.
Blank rows are kept: 61% of training rows have no feeling, and those are the
negative examples a sigmoid head needs in order to learn to say no.

`data/training/` is gitignored (full review text, same reason as
`reviews.jsonl`). The predictions in `eval/preds/` are committed: ids and scores
only, no review text, and they let anyone recheck both scores from a fresh clone.

### Scoring

    python eval/score.py eval/preds/baseline_val.jsonl --tune         --out eval/thresholds_baseline.json
    python eval/score.py eval/preds/baseline_answer_key.jsonl         --thresholds eval/thresholds_baseline.json

Tune on `val`, freeze, then score the answer key once. `score.py` refuses
`--tune --split answer_key`.

Thresholds are necessary - at these base rates a flat 0.5 predicts almost
nothing - and that makes them a knob that must be fitted off the test set.
Two failure modes bit us, in opposite directions:

- **Per-feeling tuning on every feeling.** With 6 val positives, maximising F1
  drives the threshold to the floor, because recall 1.0 at precision 0.02 beats
  any honest cut. `uncomfortable` fired on 197 of 206 reviews. Reported 0.196.
- **A global threshold pooled over all feelings.** `amused` holds 84 of 287 val
  positives and dominates the pool, so the threshold becomes amused's optimum
  and rare feelings never fire at all. Reported 0.125.

So: a feeling earns its own threshold with >= 10 val positives (9 qualify); the
rest share a global threshold fitted only on the low-support feelings that use
it. Baseline macro-F1 **0.157** over the 18 reportable feelings.

### Reproducible without the dataset

The whole eval path runs on a fresh clone with no aclImdb text present, which
is the point: a headline number nobody else can recompute is not a result.

Committed, text-free:

| file | what it is |
| --- | --- |
| `data/labels/*_labels.csv` | the labels, ids and 28 columns, no review text |
| `data/labels/corpus_ids.txt` | the 3,303 labelled reviews that have text |
| `data/training/meta.json` | the canonical feeling order, and train positives |
| `eval/metric_tiers.json` | which feelings may be reported on |
| `eval/thresholds_baseline.json` | the frozen cut points |
| `eval/thresholds_distilroberta.json` | the fine-tuned model's frozen cut points |
| `eval/thresholds_gpt55.json` | a flat 0.5, since GPT answers yes or no |
| `eval/gpt55_run.json` | the GPT run's model, settings, tokens and cost |
| `eval/preds/*.jsonl` | every system's predictions, ids and scores only |

Gitignored (carries review text): `data/{learning,checking,exam}.csv`,
`data/reviews.jsonl`, `data/training/*.jsonl`, `data/labeling/batch_*.csv`,
`eval/llm_raw/`.

`corpus_ids.txt` exists because of a bug worth not repeating. 471 labelled
reviews are non-film titles with no text (see step 6), so counts have to be
filtered to the usable 3,303. That filter originally ran against
`reviews.jsonl` - gitignored - and was written `if known and ...`, so on a
clean clone it got an empty set and quietly filtered nothing. `amused` counted
579 instead of 507. Tier membership survived by luck. Review ids are not
review text, so the usable set is committed and the filter now works
everywhere; `metric_tiers.py` exits rather than run unfiltered.

Verify after any change to the label files:

    python eval/metric_tiers.py        # should leave metric_tiers.json unchanged
    git diff --quiet eval/metric_tiers.json && echo reproduces

### The number to beat

| | macro-F1 (18 reportable) |
| --- | --- |
| predict nothing | 0.000 |
| tf-idf + logistic regression | **0.157** |
| `distilroberta-base`, fine-tuned | **0.311** |
| GPT 5.5 (see below) | **0.728** |

The baseline scores above 0 on 9 feelings and exactly 0 on the other 9; the
fine-tuned model scores above 0 on 14. It beats the baseline on 12 feelings,
loses on 2 (`thoughtful`, `nostalgic`) and ties on 4, all at 0.
Bag-of-words was what Maas et al. used on this dataset, so this is a fair
comparison point, not a strawman.

16 of the 18 feelings have 8 or fewer answer-key positives, so individual
feeling scores swing on one or two reviews. The macro number is the claim;
the per-feeling ones are not.

    python eval/compare.py baseline distilroberta

Resampling the 162 answer-key films 2,000 times puts the lead at +0.150, with a
95% range of +0.095 to +0.204, and it never reaches 0. That covers which films
were drawn, not training variation.

Two runs exist, with identical settings. The first scored 0.303, but its weights
were never saved because the notebook did not save them yet. The second scored
0.311 and is the reported model, `distilroberta-20261031-0648`. It is kept
because it is the one with weights, not because it scored higher. Two runs is a
hint at training variation, not a measurement of it.

### Against a general LLM

    python scripts/11_llm_answer_key.py --run
    python eval/score.py eval/preds/gpt55_answer_key.jsonl --thresholds eval/thresholds_gpt55.json
    python eval/compare.py gpt55 distilroberta
    python eval/by_source.py baseline distilroberta gpt55

`gpt-5.5-2026-04-23` took the same 206 reviews once, with default settings and
the prompt that wrote the training labels, for $3.24. It saw review text only.

It scored **0.728**, above the fine-tuned model on all 18 feelings. Resampling
films puts its lead at +0.412, with a 95% range of +0.329 to +0.491, and it never
reaches 0. This does not say why. The model could be too small, have too few
examples per feeling, or be limited by its training labels, which came from a
cheaper LLM (DeepSeek) using the same prompt.

The size of the lead needs two caveats. The win itself survives both.

| group | reviews | baseline | fine-tuned | GPT 5.5 |
| --- | --- | --- | --- | --- |
| hand-labelled, macro-F1 | 111 | 0.158 | 0.327 | 0.774 |
| hand-labelled, micro-F1 | 111 | 0.313 | 0.441 | 0.784 |
| spot-check, macro-F1 | 95 | 0.142 | 0.236 | 0.568 |
| spot-check, micro-F1 | 95 | 0.316 | 0.462 | 0.691 |

- **The prompt was tuned on the hand-labelled reviews.** The pilot compared LLM
  output with those labels, and the notebook says to refine the prompt from that.
  GPT does better on that group, which fits this, but the groups also differ in
  other ways, so it is not proof. The spot-check reviews played no part in the
  pilot, and GPT still leads there. Apurba filled those in, although the notebook's
  output shows the upload named `spotcheck_100_second_model.csv`.
- **One answer-key review is in the prompt's examples.** An excerpt of
  `train-unsup-11406` is a worked example with no feelings marked, and that is its
  answer-key label. Without it the score is still 0.728.

GPT costs about 1.6 cents a review, so about $545 for the 34,626 reviews above.
That is the case for a model that runs on a free Colab GPU, if a retrain can close
enough of the gap.

### Fine-tuning (Colab)

`notebooks/train_feelings.ipynb` fine-tunes `distilroberta-base` with 28
sigmoid outputs on a T4. Upload `meta.json`, `train.jsonl`, `val.jsonl` and
`answer_key.jsonl` from `data/training/`. It downloads probabilities in the
baseline's format, and the scoring is the same two commands with
`distilroberta` in place of `baseline`:

    python eval/score.py eval/preds/distilroberta_val.jsonl --tune         --out eval/thresholds_distilroberta.json
    python eval/score.py eval/preds/distilroberta_answer_key.jsonl         --thresholds eval/thresholds_distilroberta.json

The notebook drops the answer key's labels on load and computes no metric on
it. The epoch is picked on val by mean average precision, which needs no
thresholds (baseline: 0.224 on that measure). Thresholds are then fitted by
`score.py`, exactly as for the baseline.

The trained model goes to Google Drive, in
`MyDrive/scenehawk/models/<version>/`: weights, tokenizer and `meta.json`, about
330 MB, so not in git. Filling the feelings table needs it. Each run gets its own
version folder, and `distilroberta_run.json` records which one the committed
predictions came from.

## Citation

Maas, A. L., Daly, R. E., Pham, P. T., Huang, D., Ng, A. Y., & Potts, C. (2011).
*Learning Word Vectors for Sentiment Analysis.* ACL-HLT 2011, 142-150.
