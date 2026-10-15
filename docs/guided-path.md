# Guided path: steps, stages and levels

Status: agreed 2026-10-13; phase 1 built (#35); phase 2 built (#36); phase 3 built (#37). Builds on
[learning-path.md](learning-path.md), which covers the lessons and phrases this
path is made of.

## The problem

Feedback from a long-time Duolingo user: the home page didn't say where to
start, and the lessons are a lot of reading before the first question. Langue
gives learners a toolbox — lessons, phrases, flashcards, conversation — and
asks them to plan their own course. Most people want to press one button and
be given the right next thing.

## The idea in one paragraph

Everything to learn is an **item**: a word, a phrase, or a grammar idea (one
section of a lesson). Each item climbs a five-rung **stage** ladder, from
recognising it to saying it in a conversation, with spaced review in between.
A **planner** builds each ~3-minute **step** from the learner's items: a
little new material, reviews that are due, and the things they keep missing.
Steps get harder by themselves as items climb, so practice moves from
multiple choice to typing to sentences to speaking without anyone choosing a
mode. Each CEFR level is split into **10 sub-levels** (A1.1 … A1.10), so a
motivated learner levels up about once a week.

**No AI in the loop.** Scheduling, exercise choice, sentence exercises and
role-plays come from hand-written content and bookkeeping. Claude stays in the
optional tools (free conversation, tutor questions, generated drills), where a
learner chooses to use it.

## Items and stages

| Item | Source | About per A1 language |
|---|---|---|
| Word | lesson word lists + the level's vocabulary library | 250 (target ~500) |
| Phrase | the level's phrasebook | 80 |
| Grammar idea | one section of a lesson, with the questions tagged to it | 57 |

| Stage | Meaning | Word | Phrase | Grammar idea |
|---|---|---|---|---|
| 0 | introduced | — | — | — |
| 1 | recognises it | see/hear it → pick the English | same | its multiple-choice and fill-in questions |
| 2 | recalls it | English → pick it from four | same | + building its example sentences from tiles |
| 3 | produces it | English → type it | English → build it from tiles | translation leads, everything rotates |
| 4 | uses it | a sentence with it blanked out → type it | English → type it | |
| 5 | says it | a role-play turn that uses it → type the reply | same | |

Each word and phrase has a **ladder**: the exercises above, in order, minus the
ones its content can't support (a cloze needs a sentence that uses the word, a
reply needs a role-play turn that says it, tiles need a phrase of several
words). An item is practised with the rung above its stage, and **its top rung
proves everything above it** — a word no role-play uses can still reach stage 5
through its sentences. A grammar idea's questions and sentence-building all
count as its top rung; what changes with its stage is which of them it gets:
multiple choice and fill-in-the-blank while new, then building its examples,
then translation first.

**Moving up and down.**

- Right (or close: a typo, a missing accent) while the item is **due** → up one
  stage. Right while not due counts as practice and changes nothing, so
  answering the same word five times in a row cannot rush it to the top.
- Easier exercise than the item's rung (used for tricky items) → practice only.
- Wrong → down one stage (never below 0), due again in 10 minutes, and it
  comes back once at the end of the current step.
- Two misses in a row mark an item **tricky**: the next steps open with a
  short reminder card (the word with its meaning and an example, or the idea's
  tip and an example), then ask it one rung easier a few cards later, until two
  right answers in a row clear it.

**When an item is due next**, by the stage it just reached:

| Stage reached | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Next review | now | 10 min | 1 day | 3 days | 7 days | 21 days, then doubling (max 120) |

**The best stage an item ever reached is kept separately.** Progress counts
that, so a bar never goes down; an item that fades just shows up in review.

## The planner: one ~3-minute step

A budget of ~180 seconds, filled with estimated times (multiple choice ~7s,
typing ~14s, a learn card ~30s, a translation ~20s).

1. **Warm-up** — up to two due items the learner knows well. Easy wins first.
2. **New** — the next thing in the course: a learn card (one lesson section)
   and two of its questions, or 2–3 new words, or a couple of new phrases. Only
   if the learner is keeping up: fewer than 20 reviews due, at least 70% right
   recently, and no more than one sub-level ahead of their oldest unfinished
   one. Otherwise the slot goes to review, so nobody gets buried.
3. **Tricky** — up to two items they keep missing: a reminder card now, the
   item itself one rung easier among the reviews.
4. **Stretch** — a role-play that is ready and due, if they are keeping up.
   Otherwise, if nothing in the step is a sentence exercise, one sentence
   exercise (cloze, tiles, reply) for something they already know.
5. **Due reviews** — most overdue first, until the budget is used.
6. **Extra practice** — when nothing else is due, items that are due soonest.
7. Misses come back at the end; the step finishes on an easy one.

The lesson pages stay as they are: "Read the whole lesson" for anyone who
likes reading, and the old practice run still works.

## Role-plays

Short scripted conversations in `data/curriculum/<language>/<level>/dialogues.yaml`
(format in `data/curriculum/README.md`), 1–3 per unit. The other person's lines
are written out with English; at each of the learner's turns they get an English
instruction ("Order a coffee, politely") and reply. Every acceptable reply is
listed (`*` stands for a name), and typed replies get the usual typo and accent
leniency, so no model is needed.

- Each turn is tagged with the words and phrases its model answer uses (words
  of three letters or more, taught by the dialogue's unit). Answering the turn
  moves those items: typing the reply is their top rung, picking it counts as
  recall.
- A role-play **opens** once the learner has met everything it uses and
  recalled at least 60% of it, and is offered when due: a day after the first
  time, then 3, 7, 14, 30, 60 days.
- **The first time through, every reply is picked** from three (the model
  answer and turns from other role-plays — never one the turn would accept).
  The second time, turns whose words the learner can already type are typed.
  After that, all of them.
- There is no retry inside a role-play: the conversation goes on with the
  model answer, as it would in real life.
- Single turns also appear on their own as the **reply** exercise, with the
  other person's line before it for context.

## Sentences

Sentence exercises use sentences the course already has: lesson examples,
phrases, and the vocabulary libraries' example sentences (with an English
translation, the `examples_en` field, built from the sixth column of
`data/vocab_sources/*.psv`). A word is only blanked out of sentences from its
own unit or the next, translated ones first. Tiles are the sentence's words
plus two or three from other sentences of the same lesson or situation.

## Sub-levels

Each CEFR level is split into 10 sub-levels, declared in the level file as
`units`. A unit is a group of lessons, phrasebook situations and vocabulary
categories; its items are everything those contain. With today's A1 content a
unit is 1–2 lessons, about 25 words, 8 phrases and 6 grammar ideas.

- **Progress in a unit** fills as items climb: each item counts its best
  stage up to 3, so the bar moves from the first step, and 100% means every
  item is learned (best stage 3 or more). It only ever goes up.
- **A unit is complete** at 100%, or by passing its **level-up challenge**.
  The challenge is a slightly longer step (up to 16 cards) across the whole
  unit: every grammar idea, then up to seven words and three phrases, the
  ones not yet learned first, each asked at the rung that proves it is
  learned. It feels like the next step, not an exam:
  - a right answer counts as learned at once (stage 3), confirmed by a review
    three days later;
  - a wrong answer costs nothing — no stage drops, no second try, no fail
    screen, just "not quite yet" and **Try again**;
  - 80% right completes the unit: everything in it not yet learned is taken
    as probably known (stage 3), with confirming reviews spread over the next
    3–14 days so passing several units at once doesn't bury anyone;
  - after a pass, the next unit's challenge is one tap away.
- **New material** may run one unit ahead of the oldest unfinished one, so a
  learner is never stuck waiting for reviews to come due.

## Levels and hours

Published estimates are cumulative hours of teaching: A1 about 60–100 (Alliance
Française), A2 160–200 (Alliance Française), 180–200 (Cambridge). Italian,
Spanish, French and Portuguese are among the easiest for English speakers, and
a 40-hour Duolingo-based course took learners from nothing to about A1.

Langue's A1 is **about 40 hours of practice, as a guide, not a requirement**:
4 hours per sub-level, so roughly a week at 35 minutes a day. The level page
shows time practised and the finish date at the learner's own pace. Progress
is measured by mastery, never by time.

Moving up to the next CEFR level works the same way as a sub-level: finish
the last unit at 100%, or pass its challenge. A learner who already knows some
of a level can take the challenges from the start ("Test out" on the level
page); passing marks those items "probably known" (stage 3), and quick reviews
confirm them.

**The level page** (`/learn/level`) shows the level's overall bar, a count
each for words, phrases, grammar and speaking ("438 words learned · 20 on the
way · 12 not met yet", "12 conversations played · 4 to go" — counts, not bars,
so added content only raises what's not met yet), every unit with its
challenge, the can-do list, and time practised against the guide hours with an
estimated finish at the learner's own pace (the share of the level each hour
has covered so far, and minutes a day over the last two weeks). **Finishing a
level** is stored as an `Achievement` named `level:<language>:<level>`, with
the level's counts in its `detail`: it unlocks a printable certificate
(`/learn/level/certificate`) that prints those stored counts, so it never
changes after it is awarded, and a ★ badge next to the learner's name on the
leaderboard ("★ IT A1").

## Content scope

A1 and A2 get fully built out in all four languages — lessons, phrasebook and
about 500 words per level. B1 and above keep their overview pages as a taste
of what comes later.

## Build order

1. **Steps** — item tracker, planner with today's exercise types, the step
   screen, the path home page, units in the level files, and practice
   questions tagged with the section they test.
2. **Harder exercises** — sentence exercises built from lesson examples and
   phrases (cloze, translate), scripted role-plays per situation, and the
   tricky-item reminders.
3. **Levels** — the level progress page (bars, can-do checklist, time and
   pace), level-up challenges, testing out, and a certificate.
4. **Content** — A1 vocabulary to ~500 words per language, then A2 lessons,
   phrases and units.

## Data

One new table, `ItemProgress`: user, language, item key, kind, stage, best
stage, due date, right/wrong counts, consecutive right and wrong answers, the
tricky flag, and when the item was introduced and last seen.
Item keys are stable strings: `w:<language>:<word>`, `p:<phrase id>`,
`g:<lesson id>#<section number>`. Learners who already finished lessons the
old way start with those lessons' ideas and words in review rather than being
taught them again.
