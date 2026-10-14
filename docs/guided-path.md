# Guided path: steps, stages and levels

Status: agreed 2026-10-13; phase 1 built (#35). Builds on
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

| Stage | Meaning | Exercise (words, phrases) | Exercise (grammar) |
|---|---|---|---|
| 0 | introduced | — | — |
| 1 | recognises it | see/hear it → pick the English | the idea's multiple-choice questions |
| 2 | recalls it | English → pick it from four | fill-in-the-blank questions |
| 3 | produces it | English → type it | translation questions |
| 4 | uses it | it in a sentence: cloze, translate (phase 2) | new sentences on the pattern (phase 2) |
| 5 | says it | a role-play turn (phase 2) | a role-play turn (phase 2) |

An item is practised with the exercise for the rung above its stage. Until
phase 2 ships, stages 4 and 5 use typing.

**Moving up and down.**

- Right (or close: a typo, a missing accent) while the item is **due** → up one
  stage. Right while not due counts as practice and changes nothing, so
  answering the same word five times in a row cannot rush it to the top.
- Easier exercise than the item's rung (used for tricky items) → practice only.
- Wrong → down one stage (never below 0), due again in 10 minutes, and it
  comes back once at the end of the current step.
- Two misses in a row mark an item **tricky**: it gets a reminder (the
  section's tip, or the word's meaning) and a reserved slot in the next steps
  until two right answers in a row clear it.

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
3. **Tricky** — up to two items they keep missing, one rung easier.
4. **Due reviews** — most overdue first, until the budget is used.
5. **Extra practice** — when nothing else is due, items that are due soonest.
6. Misses come back at the end; the step finishes on an easy one.

The lesson pages stay as they are: "Read the whole lesson" for anyone who
likes reading, and the old practice run still works.

## Sub-levels

Each CEFR level is split into 10 sub-levels, declared in the level file as
`units`. A unit is a group of lessons, phrasebook situations and vocabulary
categories; its items are everything those contain. With today's A1 content a
unit is 1–2 lessons, about 25 words, 8 phrases and 6 grammar ideas.

- **Progress in a unit** fills as items climb: each item counts its best
  stage up to 3, so the bar moves from the first step, and 100% means every
  item is learned (best stage 3 or more). It only ever goes up.
- **A unit is complete** at 100%, or by passing its **level-up challenge**
  (phase 3). The challenge is a slightly longer step that mixes the whole
  unit and feels like the next step, not an exam: no fail screen, retry right
  away, and whatever it shows you've mastered counts.
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
of a level can take the challenges from the start; passing marks those items
"probably known" (stage 3), and quick reviews confirm them.

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
