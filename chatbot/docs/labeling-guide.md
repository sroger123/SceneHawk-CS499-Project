# SceneHawk — Review Labeling Guide

**Status:** in use for Week 3 labelling. The feelings list it refers to was frozen on 18 October 2026 — all 28 feelings, nothing cut or merged.

Revise this guide after the agreement check on the 25 shared reviews. Where two labellers disagree, the fault is in a definition here, not in the labeller.

## What you are doing
You read a film review and mark **which feelings the film gave the viewer while they
watched it**.

## The one rule
> Label **what the viewer felt while watching** — not whether they liked the film.

A review is evidence about the *film's* emotional effect. The reviewer's verdict on
quality is not.

## Three things that are NOT feelings

These are extremely common in IMDb reviews. None of them get a label.

| Not a feeling | Example | Why |
|---|---|---|
| **Quality judgment** | "Extremely unimpressive. Hoffman tries to save it and fails." | Tells us the reviewer's verdict, not how the film felt |
| **Plot summary** | "Eastwood stars as a cop who hunts a serial killer." | Describes events, not experience |
| **Craft admiration** | "Great acting, beautiful cinematography, 10/10" | Praises the making of the film, not its effect |

## Expect many reviews with NO feelings

**This is normal and correct.** A large share of reviews are pure opinion or summary. If a
review gives you no evidence of what the viewer *felt*, **leave every feeling blank**.

Do not stretch. "The film was bad" is not `sad`. "Great acting" is not `moved`.
A forced label is worse than an empty row, because the model learns the wrong thing.

## How to label

1. Read the whole review first.
2. Mark **every** feeling the film clearly produced in the viewer. A review can have
   **several**, **one**, or **none**.
3. Label only what the text supports. Do not use your own knowledge of the film.
4. If you are torn, leave it blank and add a note. Uncertainty is data: it tells us the
   definition needs work.
5. Work **alone**. Do not discuss while labeling — the whole point is to measure whether
   the guide is clear enough on its own.

## The feelings

| Group | Feelings |
|---|---|
| Fear and tension | tense, dread, scared, unsettled, disturbed |
| Sadness and loss | sad, grief-stricken, lonely, moved, bittersweet |
| Warmth and uplift | cozy, heartwarming, tender, hopeful, uplifted, joyful |
| Excitement and wonder | thrilled, amused, awed, curious |
| Reflection | thoughtful, nostalgic, inspired, confused |
| Discomfort and anger | uncomfortable, angry, disgusted, drained |

Full definitions and examples: `feelings-list.md`.

## Worked examples

These are real reviews from our corpus. Proposed labels are a starting point — confirm or
correct them as a team.

**Example 1 — no feelings**
> "I heard this film had got Oscar for something... Extremely unimpressive McQuinn's play
> and Hoffmann who tries to save the situation and fails."

**Labels: none.** Entirely a quality verdict. Nothing about what watching it felt like.

**Example 2 — no feelings**
> "Clint Eastwood stars as Wes Block a police officer who hunts a serial killer... Some
> good acting from Eastwood and Bujold elevate this one above mediocrity."

**Labels: none.** Plot summary plus a quality judgment.

**Example 3 — one feeling**
> "...he runs around being BADASS... This film is basically ninjas (rubbish ninjas) getting
> beaten up by little kids for ages... watch this movie because it's got Hulk Hogan in it."

**Labels: `amused`.** The reviewer is entertained by how silly it is. "Rubbish" is a quality
word, not a feeling — but the overall enjoyment of the absurdity is real.

**Example 4 — borderline**
> "...it's a magician of nothing, but all that 'nothing' is 'brilliant'... we can't stop to
> see this movie... I think it's pure cinema."

**Labels: `awed` (discuss).** Is being captivated by craft a *feeling the film gave you*, or
admiration of technique? The team must decide and apply it consistently.

## Edge cases to settle as a team

- **Anger at the subject vs. anger at the film.** "It made me furious how they were
  treated" = `angry`. "This movie made me angry it was so bad" = quality judgment, no label.
- **Scared vs. tense vs. dread.** `scared` = sudden fright. `tense` = sustained edge.
  `dread` = slow certainty something bad is coming.
- **Confused.** Decided: treat it as an *intended effect* ("I never knew what was real"), not as a complaint about bad writing. "The plot made no sense" gets no label.
- **Sarcasm.** "I cried laughing" is `amused`, not `sad`.
- **Second-hand reports.** "My wife cried" still counts — it is evidence about the film.

## Where the reviews come from

Large Movie Review Dataset (aclImdb). Cite: Maas et al., *Learning Word Vectors for
Sentiment Analysis*, ACL-HLT 2011, pp. 142–150.

About half our corpus is the `unsup` portion, which includes reviews of **any** rating,
including neutral ones. **Sample mostly from `unsup`** — the `pos`/`neg` portions only
contain strongly positive (>=7) or strongly negative (<=4) reviews, which skews the
feelings that appear.
