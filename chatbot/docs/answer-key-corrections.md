# Answer-key corrections

A record of deliberate changes to `exam.csv`, the answer key. It holds the team's
111 reviews plus 100 spot-check rows that started as DeepSeek's labels and were
then hand checked. The model is never trained on this set, so every edit to it
needs to be visible and justified rather than living in someone's working copy.

## 2026-10-26 - three marks cleared

Three reviews carried a feeling word that was being used as *criticism of the
film*, not as a description of how the film made the reviewer feel. The
labelling guide's rule is that a feeling is labelled when it is an intended
effect of the film; a reviewer who is annoyed at a bad film is not reporting
that the film made them feel angry.

| review id | mark cleared |
| --- | --- |
| `train-unsup-21777` | `angry` |
| `train-unsup-39335` | `disgusted` |
| `train-unsup-29432` | `thrilled` |

148 marks -> 145. Nothing else changed: same 211 rows, same ids, no review
text altered, no marks added.

The pattern worth remembering: **a feeling word used as criticism is still
criticism.** "This was disgusting filmmaking" is not `disgusted`.

`data/exam.BEFORE_FIX.csv` held the pre-correction copy and was deleted on
2026-10-28, after this diff was verified to be its only content.

## 2026-11-08 - two marks cleared, one earlier edit recorded

A read of the team's 111 reviews against the labelling guide found two more
marks that follow the 2026-10-26 pattern: the feeling is criticism of the film,
not something the film made the reviewer feel. Both were found from the review
text and the guide alone, without looking at any model's predictions.

| review id | mark cleared | evidence |
| --- | --- | --- |
| `train-unsup-18875` | `disgusted` | "I was horrified, in a bad way... the gory violence was WAY too much, and it only seemed that way because it was quite fake... 0/10". A pan. |
| `train-unsup-8518` | `angry` | "ridiculous... blatant anti-Muslim propaganda". Anger at the film itself, which the guide's edge case leaves unlabelled. |

145 marks -> 143. Both reviews are now blank. Same 211 rows, same ids, no
review text altered, no marks added.

### Recorded late: `train-unsup-8093` `curious` added

The labelling notebook (`notebooks/scenehawk_llm_labeling.ipynb`, cell 8,
committed 2026-10-26) sets this mark after loading the team's sheets:

    gold.loc[gold["id"] == "train-unsup-8093", "curious"] = 1

It was not logged here at the time. The text supports it ("I was wondering
what was going to happen if she ended up with either of them"), so it stays.
The 145-mark count above already included it.
