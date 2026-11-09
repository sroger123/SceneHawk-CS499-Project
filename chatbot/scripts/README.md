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
# db/migrations/2026-11-02_spot_check_split.sql, once, on an older database
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
| `exam.csv`, the team's 111 reviews | `answer_key` | `human` | `team` |
| `exam.csv`, the other 100 | `spot_check` | `llm` | `deepseek_hand_checked` |

The spot-check rows started as DeepSeek's labels and were then hand checked.
`data/labeling/manifest.json` says which reviews are the team's. Five spot-check
reviews are outside the corpus, so 95 get stamped.

The team was assigned 176 different reviews, but `hand_labels_all.csv`, the file
the labelling notebook loaded, held 126 rows covering only 111 of them. Nothing
records why. Of the other 65, 2 ended up in training with DeepSeek's labels, on
films outside the answer key, and 63 are unused.

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
| `data/reviews.jsonl` | 36,680 cleaned reviews, each linked to its film |
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
| `reportable` | >=3 examples across all 206 scored answer-key reviews. The wider macro-F1 covers these only. The headline applies the same rule to the team's 111 reviews, which leaves 11 feelings. |
| `trainable_only` | 1-2 answer-key examples. Train on them, do not report an F1. |
| `unmeasurable` | no answer-key examples, so recall is 0/0 and F1 is undefined. |
| `cannot_learn` | no training examples either. |

Train on all 28 regardless: the heads are independent sigmoids, so an unused one costs
nothing, and removing a feeling from the label space is hard to undo later. The limit is
answer-key size, not labelling quality - `scared` has 48 training examples and 2 in the
answer key.

Always name the metric, never bare "macro-F1": "macro-F1 over the 11 feelings with >=3
team-labelled examples" for the headline, or "macro-F1 over the 18 reportable feelings"
for the wider comparison.

## Week 4 - training data, baseline, scoring

    python scripts/09_build_training_data.py   # text + 28-wide label vector
    python scripts/10_baseline.py              # tf-idf + logistic regression

Label order comes from `docs/feelings-list.md`, the same parser step 7 uses, so
column 7 means the same feeling in training, in scoring and in the database.
Blank rows are kept: 60% of training rows have no feeling, and those are the
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
it. The results are under "The number to beat" below.

### Reproducible without the dataset

The whole eval path runs on a fresh clone with no aclImdb text present, which
is the point: a headline number nobody else can recompute is not a result.

Committed, text-free:

| file | what it is |
| --- | --- |
| `data/labels/*_labels.csv` | the labels, ids and 28 columns, no review text |
| `data/labels/corpus_ids.txt` | the 3,303 labelled reviews that are in the corpus |
| `data/training/meta.json` | the canonical feeling order, and train positives |
| `eval/metric_tiers.json` | which feelings may be reported on |
| `eval/thresholds_baseline.json` | the frozen cut points |
| `eval/thresholds_distilroberta.json` | the first fine-tuned model's frozen cut points |
| `eval/thresholds_distilroberta_e12_headtail_s49900.json` | the retrained model's frozen cut points |
| `eval/thresholds_gpt55.json` | a flat 0.5, since GPT answers yes or no |
| `eval/distilroberta_run.json`, `eval/distilroberta_e12_headtail_s49900_run.json` | each fine-tuned run's settings, epochs and val scores |
| `eval/gpt55_run.json` | the GPT run's model, settings, tokens and cost |
| `eval/preds/*.jsonl` | every system's predictions, ids and scores only |

Gitignored (carries review text): `data/{learning,checking,exam}.csv`,
`data/reviews.jsonl`, `data/training/*.jsonl`, `data/labeling/batch_*.csv`,
`eval/llm_raw/`.

`corpus_ids.txt` exists because of a bug worth not repeating. 471 labelled
reviews are from non-film titles outside the corpus (see step 6), so counts have to be
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

| | team's 111 reviews, 11 feelings | all 206 reviews, 18 reportable |
| --- | --- | --- |
| predict nothing | 0.000 | 0.000 |
| tf-idf + logistic regression | **0.226** | 0.151 |
| `distilroberta-base`, first model (6 epochs) | **0.401** | 0.298 |
| `distilroberta-base`, retrained (see below) | **0.503** | 0.423 |
| GPT 5.5 (see below) | **0.735** | 0.724 |

These are scored against the answer key as corrected on 2026-11-08 (two marks
cleared; see `docs/answer-key-corrections.md`). Before that the baseline, the
first model and GPT scored 0.222, 0.410 and 0.726 on the 111.

The first column is the headline. The other 95 scored reviews are spot-check
rows, which started as DeepSeek's labels and were then hand checked, so they are
not independent of the labels the model trained on. The >=3 rule applied to the
team's 111 leaves 11 feelings, so name this one "macro-F1 over the 11 feelings
with >=3 team-labelled examples". `eval/metric_tiers.json` still lists the 18,
which is what the second column uses. `eval/score.py` and `eval/compare.py` report
the first column by default, and the second with `--wide`.

On the 111, the baseline scores above 0 on 6 feelings and exactly 0 on the other
5; the first fine-tuned model scores above 0 on 10. It beats the baseline on 8
feelings, loses on 2 (`thoughtful`, `nostalgic`) and ties on 1 (`confused`, at
0). The retrained model scores above 0 on all 11 and beats the baseline on 10,
losing only on `nostalgic`.
Bag-of-words was what Maas et al. used on this dataset, so this is a fair
comparison point, not a strawman.

9 of the 11 feelings have 8 or fewer team-labelled positives, so individual
feeling scores swing on one or two reviews. The macro number is the claim;
the per-feeling ones are not.

    python eval/compare.py baseline distilroberta

Resampling those 74 films 2,000 times puts the lead at +0.166, with a 95% range
of +0.070 to +0.257, and it reaches 0 in 1 resample of 2,000. Over all 206
reviews it is +0.143, with a range of +0.084 to +0.195. That covers which films were drawn, not training
variation.

The first model had two runs with identical settings. Over all 206 reviews, the
first scored 0.303, but its weights were never saved because the notebook did
not save them yet. The second scored 0.311 (0.298 against the corrected key) and
is the first model, `distilroberta-20261031-0648`. It was kept because it is the
one with weights, not because it scored higher.

### Retrained model (2026-11-08)

`distilroberta-base` again, on the hand-checked training labels (see "Hand-checked
training labels" below), with two settings changed:

- **12 epochs instead of 6.** Both 6-epoch runs had picked their last epoch, so
  they were still improving.
- **Long reviews keep their start and end** (`TRUNCATION = "head_tail"`): the
  first 128 tokens and the last 384, instead of the first 512. Reviews often end
  on how the film left the viewer.

Every run is listed, including the ones not picked. The pick was made on val
only, by mean average precision; the answer-key columns played no part in it.

| run | val mAP | val macro-F1 | team's 111 | all 206 |
| --- | --- | --- | --- | --- |
| first model, 6 epochs, first 512 tokens | 0.350 | 0.385 | 0.401 | 0.298 |
| 6 epochs, checked labels (v2, 2026-11-08) | 0.354 | 0.389 | 0.367* | 0.286* |
| **12 epochs, head_tail, seed 49900 (picked)** | **0.433** | **0.468** | **0.503** | **0.423** |
| 12 epochs, head_tail, seed 49901 | 0.427 | 0.463 | 0.462 | 0.392 |
| 16 epochs, head_tail, seed 49901 | 0.430 | 0.443 | 0.543 | 0.465 |

\* against the answer key before the 2026-11-08 correction; v2's predictions
were not kept, so it cannot be rescored.

The picked run is `distilroberta_e12_headtail_s49900-20261108-2130`; only its
predictions are committed. Its weights, and the other runs', are in Google Drive.

- **The gain is real.** Every new-settings run is about +0.08 above the first
  model on val mAP, and +0.06 to +0.08 on val macro-F1. On all 206 reviews the picked run leads the first model by
  +0.112 (95% range +0.038 to +0.186, never 0 in 2,000 resamples).
- **On the 111 alone it is likely, not certain:** +0.089, range -0.021 to
  +0.195, at or below 0 in 117 of 2,000. It beats the first model on 7 feelings,
  loses on 3 (`moved`, `thrilled`, `disgusted`) and ties on 1 (`tense`).
- **A seed moves the 111 score by about 0.04.** The two 12-epoch seeds score
  0.503 and 0.462. Quote the picked run as 0.503 and the three runs as 0.46 to
  0.54, mean 0.50; never the 0.543 alone.
- **16 epochs did not help on val.** It peaked at epoch 11 and its val macro-F1
  is lower. It scored highest on the answer key, but choosing it for that would
  make the answer key a tuning set.

The labels changed together with the settings, but v2 (checked labels, old
settings) did not improve, so the gain comes from the longer training, the
start-and-end cut, or both. A 12-epoch run with `TRUNCATION = "head"` would
separate them.

### Against a general LLM

    python scripts/11_llm_answer_key.py --run
    python eval/score.py eval/preds/gpt55_answer_key.jsonl --thresholds eval/thresholds_gpt55.json
    python eval/compare.py distilroberta_e12_headtail_s49900 gpt55
    python eval/by_source.py baseline distilroberta distilroberta_e12_headtail_s49900 gpt55

`gpt-5.5-2026-04-23` took the same 206 reviews once, with default settings and
the prompt that wrote the training labels, for $3.24. It saw review text only.

On the team's 111 it scored **0.735**. Its lead over the first model was +0.334
(95% range +0.207 to +0.448); over the retrained model it is **+0.245** (range
+0.105 to +0.399), and it never reaches 0. Over all 206 reviews it scored 0.724,
a lead of +0.307 over the retrained model. This does not say why. The model
could be too small, have too few examples per feeling, or be limited by its
training labels, which came from a cheaper LLM (DeepSeek) using the same prompt.

The size of the lead needs caveats, because no part of the answer key is a clean
test of GPT. This table uses the 18 reportable feelings.

| group | reviews | baseline | first model | retrained | GPT 5.5 |
| --- | --- | --- | --- | --- | --- |
| hand-labelled, macro-F1 | 111 | 0.138 | 0.299 | 0.403 | 0.760 |
| hand-labelled, micro-F1 | 111 | 0.305 | 0.427 | 0.517 | 0.782 |
| spot-check, macro-F1 | 95 | 0.142 | 0.236 | 0.329 | 0.568 |
| spot-check, micro-F1 | 95 | 0.316 | 0.462 | 0.484 | 0.691 |

- **The prompt was tuned on the hand-labelled reviews.** The pilot compared LLM
  output with those labels, and the notebook says to refine the prompt from that.
  GPT does better on that group, which fits this, but the groups also differ in
  other ways, so it is not proof.
- **The spot-check labels came from the same prompt.** Those reviews played no part
  in the pilot, and GPT leads there too. But their labels started as DeepSeek's and
  were then hand checked, so that lead is not independent evidence.
- **One answer-key review is in the prompt's examples.** An excerpt of
  `train-unsup-11406` is a worked example with no feelings marked, and that is its
  answer-key label. Without it the scores are still 0.735 and 0.724.

GPT costs about 1.6 cents a review, so about $577 for the 36,680 reviews above.
That is the case for a model that runs on a free Colab GPU, if a retrain can close
enough of the gap.

### Fine-tuning (Colab)

`notebooks/train_feelings.ipynb` fine-tunes `distilroberta-base` (or
`roberta-base`) with 28 sigmoid outputs on a free Colab T4. Upload `meta.json`,
`train.jsonl`, `val.jsonl` and `answer_key.jsonl` from `data/training/`. The
settings cell holds every knob: `MODEL`, `EPOCHS` (12), `TRUNCATION`
(`head_tail`, or `head` for the first 512 tokens), `HEAD` (128) and `SEED`.
The run name is built from them, e.g. `distilroberta_e12_headtail_s49900`, so
runs never overwrite each other. A 12-epoch `distilroberta-base` run takes about
20 minutes.

It downloads `<RUN>_preds.zip`: probabilities in the baseline's format and a run
record. Unzip it into `eval/preds/`, move `<RUN>_run.json` up to `eval/`, then:

    python eval/score.py eval/preds/<RUN>_val.jsonl --tune         --out eval/thresholds_<RUN>.json
    python eval/score.py eval/preds/<RUN>_answer_key.jsonl         --thresholds eval/thresholds_<RUN>.json

Compare runs on val only: `val_mean_ap` in the run record, which needs no
thresholds (baseline: 0.224 on that measure), and the val macro-F1 that `--tune`
prints. Score the answer key for the one you pick. If more runs are scored on
it, report all of them, as in the table above.

The notebook drops the answer key's labels on load and computes no metric on
it. The epoch is picked on val by mean average precision.

The trained model goes to Google Drive, in
`MyDrive/scenehawk/models/<version>/`: weights, tokenizer, `meta.json` and
`scenehawk_settings.json` (how long reviews were cut), about 330 MB, so not in
git. Filling the feelings table needs it, and step 12 reads the settings file
so it cuts reviews the same way. Each run gets its own version folder, and its
run record says which one the committed predictions came from.

### Hand-checked training labels

The team checked 1,000 of DeepSeek's learning-split labels on the
label-checking page: 877 kept as they were (`agree`) and 123 corrected
(`fixed`). On 2026-11-08 the checked labels were written over the same reviews
in `data/learning.csv`, and steps 8 and 9 were rerun. That changed 129 labels on
113 of the 2,643 training reviews; `data/labels/learning_labels.csv` holds the
result.

Only `learning.csv` changed. These labels started from DeepSeek's, so they train
the model and never grade it; `checking.csv` and `exam.csv` were not touched.
The page's export (`data/labeling/scenehawk-labels-checked.csv`) carries the
review text, so it is gitignored. The one-off merge script was not kept.

## Week 5-6 - the feelings and description tables

Run `db/migrations/2026-11-06_search.sql` in the Supabase SQL editor once
first. It adds the description search index, the `match_films()` function
the website calls, and row level security.

    python scripts/13_build_descriptions.py    # film_keywords, seconds, no GPU
    # notebooks/fill_feelings_table.ipynb in Colab, which runs:
    python scripts/12_score_reviews.py --model <saved model folder>

Step 12 needs `torch` and `transformers` (Colab has both) and a GPU to be
quick. It scores every review in `reviews`, averages per film, and replaces
each scored film's rows in `film_feelings`, stamping `model_version` with the
model folder's name. Per-review scores are cached in `data/feelings/`, so a
stopped run resumes. `--dry-run` scores without writing; `--reviews
data/reviews.jsonl --limit 200` is a quick local test.

It cuts long reviews the way the model was trained, read from the model
folder's `scenehawk_settings.json`; a folder without one (the first model) gets
the first 512 tokens. The start-up line says which, e.g. `reviews cut by
head_tail at 512 tokens`.

It works with any saved version of the model. The table currently holds the
first model's scores; refill it with the retrained one,
`distilroberta_e12_headtail_s49900-20261108-2130`, which the fill notebook is
set to use.

## Citation

Maas, A. L., Daly, R. E., Pham, P. T., Huang, D., Ng, A. Y., & Potts, C. (2011).
*Learning Word Vectors for Sentiment Analysis.* ACL-HLT 2011, 142-150.
