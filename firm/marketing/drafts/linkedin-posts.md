# Draft — LinkedIn posts and the invite message (campaign 002)

**For:** the owner's own LinkedIn. The owner posts and replies; nothing here
is automated. **Brief:** `campaigns/002-how-its-built.md` (#124).
**Status:** draft, not posted.

Written in the owner's voice, first person. Change anything that doesn't
sound like you. `{…}` marks the places only you can fill. Three things to
confirm before post 1:
- **"10 to 20 minutes a day"** is the firm's working agreement (CLAUDE.md).
  Keep it only if that's how your days actually go.
- **The French line names your mother** (#97). It's a family detail in a
  public post, so cut the parenthesis if you'd rather not.
- **Naming Claude Code** is accurate (each seat is a Claude Code session, and
  10 of the 16 commits on `main` since 2026-10-15 carry a Claude co-author
  line), but optional.

---

## 1. Post 1: the story (no invite)

**Gates:** #126 (the README, from §4) is merged, so the repo link lands well. Don't name
the app's address until #72 is deployed.

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
> • a marketer isn't allowed to claim anything it can't point to in the code
>
> My part takes 10 to 20 minutes a day. Nothing ships until I say "ship it".
> In the first {five} days, {16} changes shipped.
>
> My favourite moment so far: the marketer drafted an invite saying "a
> wrong ending is marked wrong". The reviewer tested it and found that in
> French, the app accepted "J'ai parle" for "J'ai parlé", because the
> commonest past-tense ending is just an accent. So the claim got a caveat,
> the bug got a fix ({it's in review now}), and the marketer's reply began
> "the disagreement is mine".
>
> Yes, AI wrote the lessons too. Tests check the course's mechanics (every
> listed answer is graded right, nothing is taught twice), but no native
> speaker has checked the language yet ({my mother is starting on the
> French}). In the lessons themselves no AI runs: grading is plain code.
>
> Everything is public: the designs, the reviews, the arguments. {repo link}
>
> Later this autumn I'll open a small group for beginners. If you have a real
> reason to learn one of those four languages, send me a message: which
> language, and what it's for. I'll invite you when it opens.

**When posting:**
- **Recount "{16}" and "{five}" on the day:**
  `gh pr list --state merged --search "merged:>=2026-10-15" --json number --jq length`,
  and the days since 2026-10-15. If it's been more than a week or two, drop
  the sentence or write "In its first {N} weeks".
- **If #120 has shipped,** change "it's in review now" to "it's fixed now".
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
> you type real answers. The grading is strict: a wrong ending is marked
> wrong{ (a missing accent is pointed out)}. No ads, nothing to pay. No AI
> runs in the lessons.
>
> What it isn't yet: there's no speaking out loud and nothing past A2. It's
> pre-alpha, so expect rough edges, and tell me when you hit one.
>
> Want in? Send me a message: which language, and what it's for. If you
> messaged me after the last post, you'll hear from me today.

**When posting:** drop "{ (a missing accent is pointed out)}" once #114 is
live. Never put the code or the invite link in the post or a comment.

## 3. The invite message (private, one person at a time)

Sent only to people who answered "which language, and what's it for?".

> Thanks for asking! {Optional: one line on what they said, e.g. "Good luck
> with the move to Lisbon."}
>
> Langue teaches Italian, Spanish, French and Brazilian Portuguese, from
> beginner to elementary (A1 and A2): short daily steps where you type real
> answers, and a wrong ending is marked wrong{ (a missing accent is pointed
> out)}. No ads, nothing to pay.
>
> It's early. Now and then a right answer will be marked wrong, or
> something will break. When it does, tell me: that's how it gets fixed.
>
> Here's your invite. The link fills in the code, and it's open for a week:
> {link}
>
> You'll be in a small group with others who came from my post. The group
> sees each other's names, points, streaks and level badges on a
> leaderboard, so a first name or nickname is perfect. What Langue keeps
> about you: {app address}/privacy

## 4. README, top section (#126)

Post 1 links the repo, and today's README opens "Langue - AI Language
Learning" and lists levels A1–C2 (the old CLI's flashcard libraries). Proposed
replacement for its title and first paragraph. The foreman applies it word
for word as a docs PR for #126 once this PR merges (marketing doesn't edit
outside `firm/marketing/`):

> # Langue
>
> > **Read, write and speak a language correctly — at real levels, a few
> > minutes a day, without tricks.** Why and how: docs/vision.md · what's
> > next: docs/ROADMAP.md.
>
> Langue is a small, invite-only language-learning web app for family and
> friends. Its course teaches Italian, Spanish, French and Brazilian
> Portuguese at A1 and A2 (beginner and elementary), in short daily steps
> where you type real answers. No AI runs in the lessons: grading is plain
> code. Optional AI practice tools sit alongside the course.
>
> It's built and run by a small firm of AI agents (a foreman, a night shift,
> a reviewer, Socrates and a marketer) and one human owner, who decides what
> ships: see firm/README.md. The course was written and reviewed by AI
> agents and is checked by tests. Native-speaker checks are still to come
> (docs/ROADMAP.md).

And above the "Languages" table: *"The CLI's flashcard libraries (below) go
from A1 to C2; the web app's course is A1–A2."*

---

## Sources, line by line

```
CLAIM: "a staff of five … a foreman … a night shift … a reviewer … Socrates … a
marketer", and each one's job
SOURCE: firm/README.md roster (foreman: "scattered state → a true picture, designs,
and the few decisions only the owner can make"; night shift: "a ready issue → a
tested PR"; reviewer: "a PR → findings, numbers it re-ran"; Socrates: "the obvious
questions nobody asked"); MARKETING.md ("A claim with no source is cut"). Verified.

CLAIM: "Since mid-October"; "In the first five days, 16 changes shipped"
SOURCE: firm/README.md first committed 2026-10-15 (#67); gh pr list --state merged
--search "merged:>=2026-10-15" → 16 on 2026-10-20. Recount on the day.

CLAIM: "Nothing ships until I say 'ship it'"
SOURCE: CLAUDE.md working agreements; firm/README.md stages ("closed: the owner says
'ship it'; the foreman merges"). Verified.

CLAIM: "My part takes 10 to 20 minutes a day"
SOURCE: CLAUDE.md ("The owner spends ~10–20 minutes a day on the app"). It's the
owner's own claim: they confirm it before posting.

CLAIM: "the app accepted 'J'ai parle' for 'J'ai parlé' … the bug got a fix (it's in
review now) … 'the disagreement is mine'"
SOURCE: the reviewer's finding on PR #113 (probe on ef01562: "J'ai parle" → close,
counts as right); marketing's reply on PR #113 ("…and the disagreement is mine");
#114, PR #120 in review on 2026-10-20. Verified. Tense depends on #120.

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

CLAIM: "In the lessons themselves no AI runs: grading is plain code"; "Optional AI
practice tools sit alongside the course"
SOURCE: POSITIONING AI row (LIVE: app/api/steps/* makes no model call; only chat,
lessons/ask and lib/engine/activities.ts call it). Verified. Never "no AI in the
course".

CLAIM: "Everything is public: the designs, the reviews, the arguments"
SOURCE: greentheo/langue is public (CHANNELS.md; README rule 8); designs are issue
bodies, reviews are PR comments (firm/README.md "The board"). Verified.

CLAIM: "25 places"
SOURCE: 002's code, Uses 25. Verified against the brief.

CLAIM: "beginner to elementary (A1 and A2) … short daily steps where you type real
answers … a wrong ending is marked wrong (a missing accent is pointed out). No ads,
nothing to pay."
SOURCE: as in 001's message sources (POSITIONING rows; #102; #114 caveat). Verified.

CLAIM: "there's no speaking out loud and nothing past A2"
SOURCE: #54 open (speaking aloud); #57 open (B1). Verified.

CLAIM: "Now and then a right answer will be marked wrong"
SOURCE: docs/ROADMAP.md known gaps ("Stricter grading will reject some fine answers
that aren't listed"; #49). Verified.

CLAIM: "The link fills in the code, and it's open for a week"; "names, points,
streaks and level badges on a leaderboard"
SOURCE: as in 001's message sources. Verified.

CLAIM: "What Langue keeps about you: …/privacy"
SOURCE: PR #115 adds /privacy ("What Langue keeps"). Not live: a gate for the
invite message (#109 PR 1).

CLAIM: "Langue is a small, invite-only language-learning web app for family and
friends"; "Native-speaker checks are still to come"
SOURCE: lib/auth/actions.ts (invite-only); docs/vision.md "Who it's for";
docs/ROADMAP.md known gaps. Verified.
```
