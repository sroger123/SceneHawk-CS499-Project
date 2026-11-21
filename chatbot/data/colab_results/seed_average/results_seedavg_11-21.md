# roberta-base, 3-seed average: results

Three roberta-base runs that differ only in the seed (49900, 49901, 49902): 12
epochs, lr 3e-5, head_tail 512, BATCH 8 x ACCUM 2, 2,793 training reviews. The
average model is the plain mean of each review's 21 feeling probabilities
across the three runs, with equal weights and nothing tuned
(`eval/seed_avg.py`).

Rule set before the runs: the average is graded on the answer key only if its
val mAP beats the best single run (0.5647).

## Val (decides which model we keep)

| Run | Best epoch | Val mAP (21 feelings, 454 reviews) |
|---|---|---|
| seed 49900 (kept) | 11 | **0.5647** |
| seed 49901 | 12 | 0.5118 |
| seed 49902 | 12 | 0.5521 |
| mean of the three single runs | — | 0.543 |
| **average of 3 runs** | — | **0.5643** |

| Epoch (seed 49902) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Val mAP | .106 | .311 | .398 | .502 | .473 | .533 | .524 | .519 | .523 | .543 | .549 | **.552** |

The average does not beat 0.5647 (it is 0.0004 lower, effectively a tie), so
under the rule it does not replace the kept model. Seed 49900 stays the
kept model with its headline of 0.526 (macro-F1 over the 11 feelings with >= 3
team-labelled examples).

## Answer key (seed-noise measurement, asked for after the val decision)

Graded afterwards for information only, with thresholds tuned on val only. It
does not change the kept model, which was chosen on val above.

| Run | Headline: macro-F1, 11 feelings, 111 team reviews | Wide: 18 feelings, 206 reviews |
|---|---|---|
| seed 49900 (kept) | 0.526 | 0.454 |
| seed 49901 | 0.570 | 0.488 |
| seed 49902 | 0.574 | 0.475 |
| mean of the three single runs | 0.557 | 0.472 |
| average of 3 runs | 0.552 | 0.471 |

The val winner is the answer-key loser: val (DeepSeek labels, 454 reviews) and
the answer key (team labels, 111 reviews, 3-9 positives for most feelings) do
not rank seeds the same way. Report the kept model's 0.526 together with the
seed range (0.526-0.574, mean 0.557), never the best seed alone.

## What it shows

- Averaging works as expected: it scores 0.02 above a typical single run
  (0.543) and matches the luckiest one without depending on the seed.
- It does not raise the ceiling. The gain over a typical seed is smaller than
  the seed-to-seed spread (0.51-0.56 val mAP).
- The headline itself moves about 0.04 with the seed alone (0.526 for 49900,
  0.570 for 49901; see `../seed2/results_roberta_s49901_11-21.md`).

## Files

The three runs are in `../seed1/`, `../seed2/` and `../seed3/`. Here:

- `seedavg_val.jsonl`: the average model's val predictions
- `seedavg_answer_key.jsonl`: the average model's answer-key predictions

Rebuild both from `chatbot/`:

    python eval/seed_avg.py data/colab_results/seed_average data/colab_results/seed1/roberta_e12_headtail_f21_s49900_val.jsonl data/colab_results/seed2/roberta_e12_headtail_f21_s49901_val.jsonl data/colab_results/seed3/roberta_e12_headtail_f21_s49902_val.jsonl
