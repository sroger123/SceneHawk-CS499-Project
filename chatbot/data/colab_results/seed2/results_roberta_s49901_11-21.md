# roberta-base, seed 49901: seed-noise check

Model: `roberta_e12_headtail_f21_s49901-20261121-1726` (Drive). Identical to the
kept model (`..._s49900-20261121-0724`) except the seed: roberta-base, 12 epochs,
lr 3e-5, head_tail 512, BATCH 8 x ACCUM 2, 2,793 training reviews.

This run lost on val, so it is **not a contender**. It was graded on the answer
key only to measure how much the score moves between seeds. The kept model is
still chosen by val; this result does not change that.

## Val (decides which model we keep)

| Run | Best epoch | Val mAP (21 feelings, 454 reviews) | Val macro-F1, 18 feelings (thresholds tuned on val itself) |
|---|---|---|---|
| seed 49900 (kept) | 11 | **0.565** | 0.558 |
| seed 49901 | 12 | 0.512 | 0.520 |
| average of the two | — | 0.558 | — |

| Epoch | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Val mAP | .091 | .281 | .386 | .448 | .495 | .485 | .478 | .507 | .504 | .503 | .507 | **.512** |

## Answer key (seed-noise measurement, thresholds tuned on val only)

| Run | Headline: macro-F1, 11 feelings, 111 team reviews | Wide: 18 feelings, 206 reviews |
|---|---|---|
| seed 49900 (kept) | 0.526 | 0.454 |
| seed 49901 | 0.570 | 0.488 |

Headline per feeling, seed 49901:

| Feeling | Positives | Precision | Recall | F1 | Seed 49900 F1 |
|---|---|---|---|---|---|
| amused | 20 | 0.773 | 0.850 | 0.810 | 0.810 |
| tense | 7 | 0.833 | 0.714 | 0.769 | 0.600 |
| joyful | 5 | 0.750 | 0.600 | 0.667 | 0.222 |
| disgusted | 5 | 0.600 | 0.600 | 0.600 | 0.727 |
| thrilled | 4 | 0.667 | 0.500 | 0.571 | 0.750 |
| thoughtful | 9 | 0.556 | 0.556 | 0.556 | 0.400 |
| sad | 5 | 0.500 | 0.600 | 0.545 | 0.545 |
| heartwarming | 5 | 0.429 | 0.600 | 0.500 | 0.400 |
| confused | 3 | 1.000 | 0.333 | 0.500 | 0.400 |
| nostalgic | 4 | 0.400 | 0.500 | 0.444 | 0.500 |
| moved | 6 | 0.286 | 0.333 | 0.308 | 0.429 |

## What it shows

- Changing only the seed moves val mAP by 0.05 and the headline by 0.04.
- The two splits disagree on which seed is better: 49900 wins val, 49901 wins
  the answer key. With 3-9 positives per feeling, one or two reviews flip a
  feeling's F1 (joyful: 0.222 vs 0.667).
- So the headline is roughly 0.53-0.57 depending on seed, not a single number.
  Do not switch to 49901 because of its answer-key score; that would be picking
  the model by the answer key.

## Files

- `roberta_e12_headtail_f21_s49901_run.json`: run record
- `roberta_e12_headtail_f21_s49901_val.jsonl`: val predictions
- `roberta_e12_headtail_f21_s49901_answer_key.jsonl`: answer-key predictions
