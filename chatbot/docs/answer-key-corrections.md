# Answer-key corrections

A record of deliberate changes to `exam.csv`, the human answer key. The answer
key is the one set the model is never trained on, so every edit to it needs to
be visible and justified rather than living in someone's working copy.

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
