# Draft — LinkedIn posts and the invite message (campaign 002)

**For:** the owner's own LinkedIn. The owner posts and replies; nothing here
is automated. **Brief:** `campaigns/002-how-its-built.md` (#124).
**Status:** draft, not posted.

Written in the owner's voice, first person. Change anything that doesn't
sound like you. `{…}` marks the places only you can fill. Four things to
confirm before post 1:
- **"10 to 20 minutes a day"** is the firm's working agreement (CLAUDE.md).
  Keep it only if that's how your days actually go.
- **The French line names your mother** (#97). It's a family detail in a
  public post, so cut the parenthesis if you'd rather not.
- **Naming Claude Code** is accurate (each seat is a Claude Code session, and
  all 16 commits on `main` since 2026-10-15 carry a Claude co-author line),
  but optional.
- **"When it's ready" has no date on purpose.** Post 2 waits on 001's
  day-14 read and four builds (#123, #132, #63, #76; brief 002). Add a date
  only once they're scheduled.

---

## 1. Post 1: the story (no invite)

**Gates:** #126 (the README, from §4) is merged, so the repo link lands
well. #72 is deployed (8f7d6e1, 2026-10-26), so the app's address can be named.

> My family's language app has a staff of five. None of them are people.
>
> Langue is a small app I built so my family and friends can learn Italian,
> Spanish, French and Brazilian Portuguese together. Since mid-October it's
> been built and run by a "firm" of AI agents ({Claude Code sessions}), each
> with one job:
>
> • a foreman turns my ideas into designs, and brings me only the decisions
>   that are mine
> • a night shift builds whatever is ready
> • a reviewer re-runs every check and hunts for what's wrong
> • "Socrates" asks the obvious questions nobody asked
> • a marketer isn't allowed to claim anything it can't source
>
> My part takes 10 to 20 minutes a day. Nothing ships until I say "ship it".
> In the first {five} days, {16} changes merged, {half} of them to the app,
> its course and its tests.
>
> My favourite moment so far: the marketer drafted an invite saying "a
> wrong ending is marked wrong". The reviewer tested it and found that the
> app accepted French "J'ai parle" for "J'ai parlé", where the past tense
> differs from the present only by an accent. So the claim got a caveat, the
> bug got a fix (it's fixed now), and the marketer replied: "the
> disagreement is mine."
>
> Yes, AI wrote the lessons too. Tests check the course's mechanics (every
> listed answer is graded right, nothing is taught twice), but no native
> speaker has checked the language yet ({my mother is starting on the
> French}). Your answers in the daily steps are graded by plain code, not AI.
>
> The designs, the reviews and the arguments are public: {repo link}
>
> When it's ready, I'll open a small group for beginners. If you have a real
> reason to learn one of those four languages, send me a message: which
> language, and what it's for. I'll invite you when it opens.

**When posting:**
- **Recount the numbers on the day.** All merged PRs:
  `gh pr list --state merged --limit 100 --search "merged:>=2026-10-15" --json number --jq length`.
  The ones that changed the app, its course or CI (8 on 2026-10-20):
  `gh pr list --state merged --limit 100 --search "merged:>=2026-10-15" --json number,files --jq '[.[] | select(any(.files[]; (.path|test("^(web|data|langue|\\.github)/")) and (.path|test("\\.md$|\\.gitignore$")|not)))] | length'`.
  Then the days since 2026-10-15. After a week or two, write "In its first
  {N} weeks", or drop the sentence.
- **Every message asking for an invite** goes on your waiting list (your
  LinkedIn inbox). Marketing needs only how many there are.

## 2. Post 2: the group opens

**Gates:** all of 002's (the brief's "When to launch").

> A few weeks ago I wrote about the AI "firm" that builds my family's
> language app. Today I'm opening it to a small group: 25 places, for
> beginners with a real reason to learn Italian, Spanish, French or Brazilian
> Portuguese.
>
> What it is: beginner to elementary (A1 and A2), in short daily steps where
> you type real answers. A wrong ending is marked wrong, and so are some
> missing accents. No ads, nothing to pay.
>
> Who made it: AI wrote the course, and no native speaker has checked it
> yet. Your answers in the daily steps are graded by plain code, not AI.
>
> What it isn't yet: there's no speaking out loud, and the course stops at
> A2. It's pre-alpha, so expect rough edges, and tell me when you hit one.
>
> Want in? Send me a message: which language, and what it's for. If you
> messaged me after the last post, you'll hear from me today.

**When posting:**
- Keep "and so are some missing accents" after #120 ships: a bare "a wrong
  ending is marked wrong" is untrue for Spanish *hable* for *hablé*.
- Never put the code or the invite link in the post or a comment.
- **Send at most 25 invites,** one for each of the code's 25 uses.
  Everyone else who answered the question hears from you that day too:
  they're first for the next group. A 26th person to sign up would be
  turned away by the app ("That invite code has been used by everyone it
  was made for"), so never invite more people than the code has uses.

## 3. The invite message (private, one person at a time)

Sent only to people who answered "which language, and what's it for?", and
to no more than 25 of them.

> Thanks for asking! {Optional: one line on what they said, e.g. "Good luck
> with the move to Lisbon."}
>
> Langue teaches Italian, Spanish, French and Brazilian Portuguese, from
> beginner to elementary (A1 and A2): short daily steps where you type real
> answers, and a wrong ending is marked wrong (so are some missing
> accents). No ads, nothing to pay.
>
> It's early. Now and then a right answer will be marked wrong, or
> something will break. When it does, tell me: that's how it gets fixed.
>
> Here's your invite. The link fills in the code, and it's open until
> {the code's expiry day}: {link}
> It's just for you. If a friend wants in, ask them to message me.
>
> You'll be in a small group with me and others who came from my post. The
> group sees each other's names, points, streaks and level badges on a
> leaderboard, so a first name or nickname is perfect. What Langue keeps
> about you: {app address}/privacy

`{the code's expiry day}` is 7 days from when the code was made. It's the
same date for everyone, however late in the week they're invited. **Write
the day before the date `/learn/invites` shows.** That page shows the expiry
as a UTC date, and the code closes at the minute it was made, not at the
end of that day. Made on an evening in the Americas, the date shown is the
day after it closes locally.

## 4. README, top section (#126)

Post 1 links the repo. Today's README opens "Langue - AI Language
Learning" and lists levels A1–C2 (the flashcard word lists). The foreman
applies this word for word as a docs PR for #126 once this PR merges
(marketing doesn't edit outside `firm/marketing/`).

**Replaces** README lines 1–7, from the title through *"…in two forms that
share one vocabulary set:"*. The **CLI** and **Web** bullets that follow stay
as they are, with their `web/README.md` link:

~~~markdown
# Langue

> **Read, write and speak a language correctly — at real levels, a few minutes
> a day, without tricks.** Why and how: [docs/vision.md](docs/vision.md) ·
> what's next: [docs/ROADMAP.md](docs/ROADMAP.md).

Langue is a small, invite-only language-learning web app for family and
friends. Its course teaches Italian, Spanish, French and Brazilian Portuguese
at A1 and A2 (beginner and elementary), in short daily steps where you type
real answers. The daily steps, with their role-plays and grading, run no AI:
they're plain code. Optional AI tools sit alongside: a tutor at the end of
each lesson page, a conversation partner, some extra exercises (one is graded
by AI) and flashcard explanations.

It's built and run by a small firm of AI agents (a foreman, a night shift, a
reviewer, Socrates and a marketer) and one human owner, who decides what
ships: see [firm/README.md](firm/README.md). The course was written and
reviewed by AI agents, and its mechanics are checked by tests. Native-speaker
checks are still to come ([docs/ROADMAP.md](docs/ROADMAP.md)).

The repo holds two apps that share one vocabulary set:
~~~

**Added** as the first line under the "Languages" heading, above its table:

~~~markdown
The flashcard word lists (below) go from A1 to C2; the guided course is A1–A2.
~~~

The README below its first screen (the CLI's Features and Activities
sections) is the foreman's pass under #126, not this draft.

---

## Sources, line by line

```
CLAIM: "a staff of five … a foreman … a night shift … a reviewer … Socrates … a
marketer", and each one's job ("a marketer isn't allowed to claim anything it can't
source")
SOURCE: firm/README.md roster (foreman: "scattered state → a true picture, designs,
and the few decisions only the owner can make"; night shift: "a ready issue → a
tested PR"; reviewer: "a PR → findings, numbers it re-ran"; Socrates: "the obvious
questions nobody asked"); MARKETING.md ("A claim with no source is cut"). Verified.

CLAIM: "Since mid-October"; "In the first five days, 16 changes merged, half of them
to the app, its course and its tests" (#68 is CI)
SOURCE: firm/README.md first committed 2026-10-15 (#67); gh pr list --state merged
--search "merged:>=2026-10-15" → 16 on 2026-10-20, of which 8 changed the app, its
course or CI (#68, #83, #86, #88, #89, #92, #96, #102; the reviewer's count, matched
by the command above). The other 8 are firm docs, roadmaps and marketing briefs.
Recount on the day. ("shipped" was cut: it read as 16 app changes.)

CLAIM: "Nothing ships until I say 'ship it'"
SOURCE: CLAUDE.md working agreements; firm/README.md stages ("closed: the owner says
'ship it'; the foreman merges"). Verified.

CLAIM: "My part takes 10 to 20 minutes a day"
SOURCE: CLAUDE.md ("The owner spends ~10–20 minutes a day on the app"). It's the
owner's own claim: they confirm it before posting.

CLAIM: "the app accepted French 'J'ai parle' for 'J'ai parlé', where the past tense
differs from the present only by an accent … the bug got a fix (it's fixed now) …
the marketer replied: 'the disagreement is mine.'"
SOURCE: the reviewer's finding on PR #113 (probe on ef01562: "J'ai parle" → close,
counts as right); marketing's reply on PR #113, 2026-10-19 ("Thanks. All three are fixed in `b664d58`
and `7749747`, and the disagreement is mine."), quoted from its end, not "began";
parle is the present (je parle), parlé the past participle;
#114, PR #120 deployed 2026-10-26 (8f7d6e1): "J'ai parle" → incorrect there. Verified.

CLAIM: "AI wrote the lessons too … no native speaker has checked the language yet
(my mother is starting on the French)"
SOURCE: #97 (foreman: "every line of A1 and A2 was written by AI writer agents and
reviewed by AI"; owner: "my mom is a native french speaker she'll let me know on
french"); docs/ROADMAP.md known gaps ("no line has had a native speaker's check yet").
Verified. "starting on" is the owner's to confirm.

CLAIM: "Tests check the course's mechanics (every listed answer is graded right,
nothing is taught twice)"
SOURCE: CLAUDE.md ("they verify every listed answer grades correct, nothing is taught
twice, every card renders"). Verified. Not "tests check the language is right".

CLAIM: "Your answers in the daily steps are graded by plain code, not AI" (post 1);
"Your answers in the daily steps are graded by plain code, not AI" (post 2); README
"The daily steps, with their role-plays and grading, run no AI … Optional AI tools
sit alongside: a tutor at the end of each lesson page, a conversation partner, some
extra exercises (one is graded by AI) and flashcard explanations"
SCOPE: always "in the daily steps". The optional Translation exercise is graded by
the model (api/exercises/grade/route.ts l.11–12, gradeTranslation); unqualified
"graded by plain code" was a re-check finding (reviewer, PR #125).
SOURCE: POSITIONING AI rows (corrected in this PR: app/api/steps/* makes no model
call, and no step component reaches an AI route; the lesson page's "Ask about this
lesson" box, app/learn/lessons/[id]/page.tsx l.98–103, calls app/api/lessons/ask).
Verified. The first draft said "no AI runs in the lessons", which the lesson page's
AI box contradicts (reviewer, PR #125). Never "no AI in the lessons" or "in the
course".

CLAIM: "Who made it: AI wrote the course, and no native speaker has checked it yet"
(post 2)
SOURCE: #97, as for post 1. Post 2 carries it too: LinkedIn shows each post on its
own, and "graded by plain code, not AI" mustn't read as "no AI in the course".

CLAIM: "The designs, the reviews and the arguments are public"
SOURCE: greentheo/langue is public (CHANNELS.md; README rule 8); designs are issue
bodies, reviews are PR comments (firm/README.md "The board"). Verified. Not
"everything": the owner's words in seat sessions, and the seats' messages to each
other, aren't public (only their outcomes, on the issues).

CLAIM: "25 places"
SOURCE: 002's code, Uses 25. Verified against the brief.

CLAIM: "beginner to elementary (A1 and A2) … short daily steps where you type real
answers … a wrong ending is marked wrong, and so are some missing accents. No ads,
nothing to pay." (Not "the grading is strict": a missing accent that makes no word
and a mid-word typo count as right, and attivo for cattivo is forgiven until #106.)
SOURCE: as in 001's message sources (POSITIONING rows; #102; #120, probe on 51b6ed8).
Post 2 and §3 are gated on #72, which ships after #120. Verified.

CLAIM: "there's no speaking out loud, and the course stops at A2"
SOURCE: #54 open (speaking aloud); #57 open (B1). Verified. Not "nothing past A2":
flashcards and the AI tools offer B1–C2 (lib/vocab isLevel, availableLevels).

CLAIM: "Now and then a right answer will be marked wrong"
SOURCE: docs/ROADMAP.md known gaps ("Stricter grading will reject some fine answers
that aren't listed"; #49). Verified.

CLAIM: "The link fills in the code, and it's open until {the code's expiry day}"
SOURCE: register/page.tsx codeFromQuery; lib/auth/invites.ts l.49–51 (expiresAt =
when the code is made + expiresInDays); invite-status.ts l.22 (closes at that
minute); learn/invites/page.tsx formatDay (a UTC date), hence "the day before". Not "open for a week": that's true only for
someone invited on day 0 (reviewer, PR #125). Verified.

CLAIM: "a small group with me and others who came from my post … names, points,
streaks and level badges on a leaderboard"
SOURCE: lib/auth/invites.ts l.66–67 (the code's maker joins its group); as in 001's
message sources for the leaderboard. Verified.

CLAIM: "A 26th person to sign up would be turned away by the app"
SOURCE: lib/auth/actions.ts USED_UP ("That invite code has been used by everyone it
was made for. Ask whoever sent it for a new one."). Verified.

CLAIM: "What Langue keeps about you: …/privacy"
SOURCE: PR #115 adds /privacy ("What Langue keeps"). Not live: a gate for the
invite message (#109 PR 1).

CLAIM: README "Langue is a small, invite-only language-learning web app for family
and friends"; "its mechanics are checked by tests"; "Native-speaker checks are still
to come"; "The repo holds two apps that share one vocabulary set"; "The flashcard
word lists (below) go from A1 to C2; the guided course is A1–A2"
SOURCE: lib/auth/actions.ts (invite-only); docs/vision.md "Who it's for";
docs/ROADMAP.md known gaps; today's README l.7 ("two forms that share one vocabulary
set"); the web flashcards use the same libraries (lib/vocab/index.ts), and the course
is A1–A2 (POSITIONING). Verified.
```
