# Colab results

Outputs of `notebooks/train_feelings.ipynb`, one folder per run. The model
weights stay in Google Drive (`MyDrive/scenehawk/models/<model_version>/`); here
are the run record, the predictions and a results note. Prediction files hold
review ids and scores only, no review text.

| Folder | Run | Val mAP (21 feelings) | Headline* |
|---|---|---|---|
| `seed1/` | roberta-base f21, seed 49900, + Roger's 150 (`..._s49900-20261121-0724`) | 0.565 | 0.526 |
| `seed2/` | same, seed 49901 (`..._s49901-20261121-1726`) | 0.512 | 0.570 |
| `seed3/` | same, seed 49902 (`..._s49902-20261121-1754`) | 0.552 | 0.574 |
| `seed_average/` | equal-weight average of seed1-3 | 0.564 | 0.552 |

\*macro-F1 over the 11 feelings with >= 3 team-labelled examples, 111 team
reviews. Reported score for roberta-base f21: **0.557 +/- 0.027**, the mean
over the three seeds. seed1 was picked on val, before the others were graded.

The website table is filled from the `seed_average` models
(`notebooks/fill_feelings_table.ipynb`, version
`roberta_e12_headtail_f21_seedavg3-20261121`).
