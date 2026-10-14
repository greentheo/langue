# Curriculum content

Lessons, phrasebooks and level overviews for the web app's **Lessons** and
**Phrases** sections. See `docs/learning-path.md` for why they exist and how
they fit with the practice activities.

Everything here is compiled into `web/src/lib/curriculum/generated.ts` at
build time and validated against `web/src/lib/curriculum/schema.ts`. Check
your work with:

```bash
cd web && npm run curriculum:check                       # everything
cd web && npx tsx scripts/build-curriculum.mts --check --language italian
```

## Layout

```
data/curriculum/<language>/<level>/
  level.yaml            what the level means: can-do list, grammar checklist, themes
  phrases.yaml          the phrasebook for the level, grouped by situation
  lessons/NN-slug.yaml  the lesson path, in order (01-greetings.yaml, 02-sounds.yaml, …)
```

Languages are the same directory names as `data/flashcard_libraries`
(`french`, `italian`, `portuguese`, `spanish`). Portuguese is **Brazilian**
Portuguese (*você*, *ônibus*, *café da manhã*), matching the vocabulary.

## Who we are writing for

English speakers starting from zero: adults, and also kids around 10–16 who
are testing the app. Write so a 12-year-old can follow it:

- Plain English. Use a grammar term only after saying what it means
  ("the *infinitive* — the dictionary form, like *to speak*").
- Short. A section body is 40–120 words. If it needs more, split it.
- Friendly, never cute. No exclamation-mark overload, no emoji.
- Show, then tell, then show again: rule → table → examples.
- Aim the `tip` at what English speakers actually get wrong.

## Lesson file

```yaml
title: "Il, lo, la"                    # short; in the target language is fine
subtitle: Nouns, plurals and articles  # plain English
goal: tell masculine from feminine, make plurals, and pick the right word for "the" and "a"
minutes: 12
sections:
  - heading: Every noun is masculine or feminine
    body: |
      Usually **-o** is masculine and **-a** is feminine.

      - *il libro* — the book
      - *la casa* — the house
    table:                             # optional; every row has one cell per column
      columns: ["", singular, plural]
      rows:
        - [masculine, il libro, i libri]
    examples:                          # optional; [target, english]
      - ["Il libro è nuovo.", "The book is new."]
    tip: "*Problema* ends in -a but is masculine: *il problema*."
words:                                 # 8–15 pairs this lesson introduces
  - [libro, book]
practice:                              # 10–16 items
  - type: fill
    section: 1                         # the section this question tests (1 = first)
    prompt: "___ studente"             # exactly one ___
    hint: the                          # shown beside the blank
    translation: the student           # optional English for the whole thing
    answers: [lo]
    why: Studente starts with s + consonant, so it takes lo.
  - type: translate
    section: 1
    direction: to-target               # English prompt, target-language answer
    prompt: the friends (all male)
    answers: [gli amici]
    why: Amico starts with a vowel, so the plural article is gli.
  - type: translate
    section: 1
    direction: to-english              # target-language prompt, English answer
    prompt: le case
    answers: [the houses, the homes]
    why: Le is the feminine plural "the".
  - type: choice
    section: 1
    prompt: Which article does *zaino* take?
    options: [il, lo]
    answer: lo                         # must match one option exactly
    why: Zaino starts with z, and z takes lo.
```

`body`, `tip`, table cells, example sentences and `why` support **bold**,
*italic*, paragraphs separated by a blank line, and `- ` bullet lists.

### Practice rules

- **Every question names its `section`.** The guided path
  ([docs/guided-path.md](../../docs/guided-path.md)) teaches one section as a
  short card and asks that section's questions straight after it, then keeps
  using them for review. Tag a question with the section that teaches what it
  tests; if it needs two sections, the later one. Every section needs at least
  one question, and two or three is better — the build fails on a section
  with none.
- **Keep sections card-sized.** A section is read on its own, on a phone, in
  about thirty seconds: one idea, a few short paragraphs, a table or examples.

- **Only use what has been taught.** Lesson 7's items may use grammar and
  words from lessons 1–7, plus the level's phrasebook as fixed chunks. Nothing
  else. This is the most important rule.
- Mix the types: at least 3 `fill`, 3 `translate` (both directions), 2 `choice`.
- `answers` must list **every** answer a learner could reasonably give that is
  correct: with and without the subject pronoun (*sono stanco* / *io sono
  stanco*), masculine and feminine where the prompt does not say which,
  formal and informal where the prompt does not say which, word-order
  variants. If the prompt is ambiguous, either list every reading or make
  the prompt specific ("(to a friend)", "(a woman speaking)").
- English answers: list natural variants ("what is your name", "what's your
  name" are treated as the same automatically — contractions are expanded —
  but synonyms such as "hi" / "hello" must be listed).
- Grading ignores capital letters and punctuation, and an answer containing
  a correct answer plus extra words is accepted. Accent mistakes are graded
  as *close*, not wrong, so always write accents correctly in `answers`.
- When the accent **is** the point of the item (*c* or *ç*? *por qué* or
  *porque*?), add `strict_accents: true` to it: a missing or wrong accent
  is then simply wrong.
- `why` is one sentence that teaches: the rule that makes the answer right.
- Keep `fill` blanks to one word or a short chunk, with a `hint` saying
  which form is wanted, e.g. `essere, io` or `the` (the page adds the
  parentheses).

## Level file

```yaml
title: Beginner
summary: One or two sentences on what this level is.
can_do:                     # 6–9 "you can…" statements from the CEFR descriptors
  - greet people and introduce yourself
grammar:                    # the grammar inventory for this level, in teaching order
  - topic: Articles — il, lo, la, i, gli, le; un, uno, una
    lessons: [04-articles]  # slugs of lessons at this level that teach it (A1 only for now)
themes: [greetings, family, food and cafés]
units:                      # the 10 sub-levels (A1.1 … A1.10) of the guided path
  - title: Hello!
    lessons: [01-greetings]       # in lesson-number order across all units
    situations: [greetings]       # phrasebook situation ids
    categories: [greetings]       # vocabulary-library categories at this level
```

`units` split the level into ten steps a motivated learner can finish in about
a week each. Every lesson, phrasebook situation and vocabulary category of the
level belongs to exactly one unit — the build checks this. Lessons must stay in
number order, because a lesson's practice may use earlier lessons.

`can_do` items complete the sentence "At this level you can…", so start them
with a lowercase verb.

## Phrases file

```yaml
situations:
  - id: greetings                     # use the shared ids below
    title: Greetings and politeness
    phrases:
      - target: ["Come ti chiami?"]
        english: ["What's your name?", "What is your name?"]
        note: Informal. To a stranger or someone older, say *Come si chiama?*
        literally: how yourself (you) call?
      - target: ["Sono americano.", "Sono americana."]
        display: Sono americano / americana.
        english: ["I'm American.", "I am American."]
        note: "-o if you're male, -a if you're female."
```

Use these situation ids so every language's phrasebook lines up:
`greetings`, `meeting`, `understanding`, `cafe`, `shopping`,
`getting-around`, `time`, `help`, `small-talk`.

- `target`: every interchangeable form a learner might type (gender variants,
  with/without pronoun). The first is shown unless `display` overrides it.
- `literally`: a word-by-word gloss whenever it reveals how the phrase is
  built — this is where learners see the grammar before they study it.
- `note`: register (formal/informal), when to use it, a common mistake.
- A phrase appears in only one situation.
