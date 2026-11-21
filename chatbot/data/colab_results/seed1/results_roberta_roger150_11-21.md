# roberta-base with Roger's 150 hand labels: results

Model: `roberta_e12_headtail_f21_s49900-20261121-0724` (Drive). roberta-base,
seed 49900, 12 epochs, lr 3e-5, head_tail 512, BATCH 8 x ACCUM 2 (one step per 16
reviews, as every run). Training data: 2,793 reviews (2,643 + Roger's 150).

## Val (decides which model we keep)

| Model | Best epoch | Val mAP (21 feelings, 454 reviews) |
|---|---|---|
| **roberta-base, + Roger's 150** | 11 | **0.565** |
| roberta-base, old labels | — | 0.522 |
| distilroberta, + Roger's 150 | 9 | 0.516 |
| distilroberta, old labels | — | 0.484 |
| Run A, live model, scored on 21 | — | 0.459 |

Best val so far, so it was graded on the answer key once, with thresholds tuned
on val only. Val mAP checked independently from the predictions: 0.5647.

| Epoch | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Val mAP | .125 | .368 | .404 | .447 | .491 | .517 | .534 | .536 | .557 | .545 | **.565** | .557 |

## Answer key (graded once)

| Model | Headline: macro-F1, 11 feelings, 111 team reviews | Wide: 18 feelings, 206 reviews |
|---|---|---|
| **roberta-base, + Roger's 150** | **0.526** | **0.454** |
| roberta-base, old labels | 0.500 | 0.456 |
| distilroberta, + Roger's 150 | 0.475 | 0.352 |
| distilroberta, old labels | 0.452 | — |
| Run A, live model, scored on 21 | 0.489 | 0.417 |

Headline per feeling (111 team reviews):

| Feeling | Positives | Precision | Recall | F1 |
|---|---|---|---|---|
| amused | 20 | 0.773 | 0.850 | 0.810 |
| thrilled | 4 | 0.750 | 0.750 | 0.750 |
| disgusted | 5 | 0.667 | 0.800 | 0.727 |
| tense | 7 | 1.000 | 0.429 | 0.600 |
| sad | 5 | 0.500 | 0.600 | 0.545 |
| nostalgic | 4 | 0.500 | 0.500 | 0.500 |
| moved | 6 | 0.375 | 0.500 | 0.429 |
| heartwarming | 5 | 0.400 | 0.400 | 0.400 |
| thoughtful | 9 | 0.500 | 0.333 | 0.400 |
| confused | 3 | 0.500 | 0.333 | 0.400 |
| joyful | 5 | 0.250 | 0.200 | 0.222 |

10 of the 11 headline feelings have 9 or fewer positives, so one review moves a
feeling's F1 by 0.1-0.3 and the headline by a few hundredths. Cite the headline
with its qualifier ("macro-F1 over the 11 feelings with >= 3 team-labelled
examples"), never as bare macro-F1.

## Files

- `roberta_e12_headtail_f21_s49900_run.json`: run record
- `roberta_e12_headtail_f21_s49900_val.jsonl`: val predictions
- `roberta_e12_headtail_f21_s49900_answer_key.jsonl`: answer-key predictions
