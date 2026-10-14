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
  dialogues.yaml        scripted role-plays for the guided path, one or two per unit
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

Use these situation ids so every language's phrasebook lines up.

- **A1:** `greetings`, `meeting`, `understanding`, `cafe`, `shopping`,
  `getting-around`, `time`, `help`, `small-talk`.
- **A2:** `plans` (making arrangements, inviting, accepting, declining),
  `travel` (tickets, platforms, delays, luggage), `hotel` (booking, checking
  in, problems with the room), `restaurant` (booking, ordering, complaining
  politely, paying), `clothes` (sizes, colours, trying on, returning),
  `health` (pharmacy, doctor, describing symptoms), `home` (rooms, chores,
  where things are, renting), `stories` (what you did, how it went, reacting
  to news), `phone` (calls, messages, leaving a message).

A phrase a level teaches is not repeated at a later level; the guided path
skips it if it is.

- `target`: every interchangeable form a learner might type (gender variants,
  with/without pronoun). The first is shown unless `display` overrides it.
- `literally`: a word-by-word gloss whenever it reveals how the phrase is
  built — this is where learners see the grammar before they study it.
- `note`: register (formal/informal), when to use it, a common mistake.
- A phrase appears in only one situation.

## Vocabulary examples

The guided path blanks words out of their vocabulary-library examples
(`data/vocab_sources/<language>/<level>.psv`, fourth column of five or six)
for fill-in-the-blank, and shows the sixth column, the example in English,
underneath. So an example sentence should:

- contain the word **exactly as listed** (not a plural or another form), as a
  separate word;
- use only grammar the level teaches — present tense at A1 (no past tenses,
  no *-ing* forms); past tenses arrive at A2;
- be short (4–10 words) and everyday;
- use the variety the course teaches: Brazilian Portuguese, neutral
  Latin-American-friendly Spanish (*tomar el autobús*, never *coger*).

## Dialogues file

Short scripted conversations. On the guided path a learner plays one once its
unit's phrases are familiar: the other person's lines are shown (and spoken),
and at each of the learner's turns they get an English instruction and reply,
first by picking from a few replies, later by typing. Single turns also turn
up as review ("The barista says… — order a coffee"). No AI is involved, so
**every reply we accept has to be listed**.

```yaml
dialogues:
  - id: cafe-order                # unique within the level
    unit: 9                       # the sub-level (A1.9) whose words and phrases it uses
    title: At the bar
    setting: You're in a café in Rome. Order something to drink.
    with: the barista             # who the learner is talking to
    lines:
      - them: Buongiorno! Cosa prende?
        english: Good morning! What will you have?
      - you: Order a coffee, politely.
        answers:
          - Un caffè, per favore.
          - Vorrei un caffè, per favore.
          - Prendo un caffè, per favore.
          - Un caffè, grazie.
      - them: Ecco a Lei. Altro?
        english: Here you are. Anything else?
      - you: Say no thanks, and ask how much it is.
        answers:
          - No, grazie. Quanto costa?
          - No, grazie. Quant'è?
```

- **4–12 lines, at least two `you` turns**, usually alternating. A1 lines are
  short: 2–8 words.
- **`you` is an instruction in English** that leads to one meaning: "Ask her
  name" (not "Say something"). Mention formal/informal when it matters
  ("Ask the waiter how much it is — politely").
- **`answers`: the first is the model answer** shown after the turn, so it is
  concrete (no `*`). Then every natural variant a beginner might type: with
  and without *per favore*, with and without the subject pronoun, *tu*/*Lei*
  where both fit, common word-order swaps. Aim for 2–5. Spelling and accents
  are graded leniently, so don't list typos.
- **`*` stands for a free word**, for names and personal details:
  `Mi chiamo *.` accepts any name. Only in answers after the first.
- **Stay inside the course**: use phrases from the level's phrasebook and
  words from lessons in this unit or earlier, so the learner has met
  everything. The `them` lines can stretch a little — they come with English.
- Each turn's first answer must differ from the other turns' first answers in
  the same dialogue (they become each other's wrong options).
- Mix scenes: travel (café, station, hotel, shop, asking the way) and
  everyday life for kids and adults (school, friends, family, pets, sport,
  food, the weekend).
