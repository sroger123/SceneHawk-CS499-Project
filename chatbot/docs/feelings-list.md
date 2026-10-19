# SceneHawk — Feelings List

**Status: FROZEN.** Agreed by the team on 18 October 2026. All 28 feelings kept as
drafted; nothing cut, merged or renamed.

This list is the source of truth. Three other places must match it exactly:
the `feelings` table in `chatbot/db/schema.sql`, the label list in the training
notebook, and the feeling columns in the labelling sheet. Changing it means
changing all four.

## The labeling rule
Label **what the viewer felt while watching** — *not* whether they liked the film.

- ✅ "I was on edge the whole time" -> **tense**
- ❌ "Great acting, 10/10" -> that is a quality judgement, not a feeling
- ❌ "Boring and badly paced" -> criticism, not a felt experience

A review can carry **several** feelings at once (multi-label), or none.

---

## Fear & tension
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| tense | On edge, braced, waiting for something bad | "I was gripping the armrest the whole time" |
| dread | Slow-building certainty that something awful is coming | "You feel it coming an hour before it arrives" |
| scared | Sudden fright, startled, afraid | "I jumped out of my seat twice" |
| unsettled | Quietly wrong, hard to place, gets under the skin | "Something about it stayed wrong in my head for days" |
| disturbed | Deeply shaken, haunted afterwards | "I couldn't sleep after watching it" |

## Sadness & loss
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| sad | Sorrowful, downcast | "I teared up in the last twenty minutes" |
| grief-stricken | Heavy mourning, the ache of real loss | "It captures what losing a parent actually feels like" |
| lonely | Isolated, aching solitude | "The emptiness of it got under my skin" |
| moved | Emotionally touched, welling up | "It hit me right in the chest" |
| bittersweet | Happy and sad at the same time | "I was smiling and crying at once" |

## Warmth & uplift
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| cozy | Warm, safe, comforted | "Perfect for a rainy Sunday under a blanket" |
| heartwarming | Tender affection, softened | "Their friendship completely melted me" |
| tender | Gentle, treated with care | "It treats its characters so gently" |
| hopeful | Lifted, believing things can get better | "I left feeling like things might be okay" |
| uplifted | Spirits raised, buoyant | "I walked out grinning" |
| joyful | Happy, delighted | "Pure delight from start to finish" |

## Excitement & wonder
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| thrilled | Adrenaline, exhilarated, breathless | "The chase had me breathless" |
| amused | Entertained, laughing | "I laughed way more than I expected" |
| awed | Struck by scale, beauty, or spectacle | "The visuals genuinely took my breath away" |
| curious | Pulled forward, needing to know | "I had to know what was behind that door" |

## Reflection
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| thoughtful | Left thinking, reflective afterwards | "I was still turning it over the next morning" |
| nostalgic | Warm pull toward the past | "It felt like being twelve again" |
| inspired | Motivated, wanting to act or create | "I wanted to go make something" |
| confused | Lost, unsure what is real (as an experience) | "I spent half of it not knowing what was happening" |

## Discomfort & anger
| Feeling | One-line definition | Example phrasing in a review |
|---|---|---|
| uncomfortable | Squirming, awkward, hard to sit through | "The dinner argument was almost unbearable" |
| angry | Indignant, outraged on someone's behalf | "It made me furious at how they were treated" |
| disgusted | Repulsed, sickened | "I had to look away during that scene" |
| drained | Emotionally wrung out, exhausted | "I needed a minute before I could speak" |

**Total: 28 feelings**

---

## Borderline cases — decided

These five were flagged as likely to cause disagreement. The team reviewed them and
kept the list unchanged. Recorded here so the reasoning is not lost:

- **bored** — not included. It describes a verdict on the film more than a felt
  experience, and the labelling rule excludes verdicts.
- **confused** — kept. Treated as an intended effect ("I never knew what was real"),
  not as a complaint about bad writing.
- **moved** vs **sad** — kept separate. *sad* is sorrow; *moved* is being touched,
  which can be positive.
- **uplifted** vs **joyful** — kept separate. *joyful* is happiness during;
  *uplifted* is how you are left afterwards.
- **tender** vs **heartwarming** — kept separate. *tender* describes how the film
  treats its subject; *heartwarming* describes the effect on the viewer.

If labelling in Week 3 shows any of these being applied inconsistently in practice,
revisit them then — and update all four places listed at the top.
