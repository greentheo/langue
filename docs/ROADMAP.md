# Roadmap

What's live, what's known to be missing, and what's next — in the order we
plan to do it. The why behind all of it is [vision.md](vision.md).

## How we work

- **20–30 minutes a day learning, 10–20 minutes improving the app.** A small
  team of agents — the firm ([firm/README.md](../firm/README.md)) — moves
  issues through design → Socrates' questions → night shift builds → reviewer
  checks → the owner says "ship it". The foreman keeps the queue full and
  brings the owner only the decisions that need them. 1% better every day.
- Issues labelled **`background`** can be built without the owner; **size**
  labels say roughly how long (S ≈ one sitting, M ≈ a day or two of
  background work, L ≈ several PRs).
- `main` deploys to Railway automatically. Nothing merges without the owner's
  go-ahead.

## Where we are (October 2026)

**Live**
- Web app on Railway, invite-only, several learners per device, a
  leaderboard per invite group (join more groups with a code).
- Guided path ([guided-path.md](guided-path.md)): ~3-minute steps; items climb
  from recognising to recalling, building, typing, fill-in-the-blank and
  role-play replies; reminders for tricky items; spaced review.
- A1 (~520 words) and A2 (~450–540 words) in Italian, Spanish, French and
  Brazilian Portuguese: 15 lessons, phrasebook, 10 units and 16 role-plays
  per level. B1–C2 have overview pages only.
- Level page with bars, level-up challenges, testing out, certificates and
  badges; progress bars that never go down.
- Strict, explained grading (accents, pronouns, whole words, and endings
  through A2: a slip that changes an ending is a mistake, #70); answer sounds;
  pronunciation by the device voice.
- Level page counts ("N learned · N on the way · N not met yet") and
  certificates that keep their numbers (#91).
- Installable as an app (PWA); streak reminders after 2, 5 and 12 quiet days;
  streaks are never lost.
- Optional AI tools (conversation, generated drills) on the cheapest model.
- CI on every pull request: typecheck, tests (content tests included),
  curriculum and vocabulary checks, and the production build (#48).
- In-house usage events, with no third parties and nothing stored on the
  device (visitors counted by a daily hash whose salt is never kept), hourly
  housekeeping, and a public "What Langue keeps" page (#109; the dashboard is
  its second PR).

**Known gaps and issues**
- Grading: a slip in a word's last three letters now counts as a miss even
  when it's a plain typo (the price of #70's safety; #105 is the way back); a
  slip that makes a different real word is still forgiven (#106); multi-word
  nouns typed with their article are marked wrong (#101).
- Progress safety: fixing a word's spelling orphans learners' progress on it
  (#93); words added to a finished unit never reach those learners (#90).
- The path stops at A2 — no B1 yet (#57).
- Stricter grading will reject some fine answers that aren't listed; there's
  no way for a learner to flag them yet (#49).
- Content: no line has had a native speaker's check yet; French will be
  checked by a native speaker in the family (#97). Fill-in-the-blank borrows
  sentences where a word means something else (#82); Spanish *a* is treated as
  an article in the course dedupe (#85).
- No usage dashboard yet (#109, second PR), and no learning measures (#52).
- Writing, dictation, speaking aloud and reading — four of the vision's
  promises — aren't built yet (#51, #54, #56, #58).
- No account deletion or privacy page (#63). Still on the Railway URL while a
  domain is chosen (#62).
- On iPhone, the installed app keeps its own login (platform behaviour).
- The legacy Python CLI's issues (#7–#27) are mostly stale (#64).

## Next up

Roughly in order; each line is one or a few PRs. The board is the record:
`stage: ready` issues are designed and through Socrates; `Blocked by:` lines
set the order where it matters. **Owner's order (#98): the differentiators
first, then B1 and B2; C1–C2 wait.**

**First — the owner's order for the pre-alpha (2026-10-23)**
The owner chose "yes, capped" for people they don't know (#124). Everything
here is live before campaign 002's post opens the LinkedIn group; its gates
are in `firm/marketing/campaigns/002-how-its-built.md`.
0. #109 Eventing and the first dashboard (in review: #115, #117) · #114 A missing accent that changes the grammar is a mistake (in review: #120)
1. #72 Front page and invite copy — S
2. #119 Admin pages ask for the password again (one-tap switching stays) — S
3. #123 Cap AI use per learner, per invite code and per day — M (after #109)
4. #63 Privacy page, account deletion, age checkbox — M (after #109)
5. #76 Password reset without email — M (after #63)
6. #118 The owner's learner list — S (after #109, #119)
7. #93 Item keys survive content edits (lock + renames) — M
· #126 README first screen (the foreman, docs only) · then #52 (learning measures) and #110 (campaign link tags)

**Now — accuracy and progress safety (bugs first)**
8. #107 Neutral ending note · #82 Cloze homographs · #85 Articles per language — S
9. #101 Multi-word nouns with their article · #104 Noun genders (after #99) — S/M
10. #105 Endings gap-finder, then forgive end-of-word typos again — M · #106 Different-word typos — S
11. #90 "What's new since you finished" — L (after #93)
12. #80, #81 CI hardening · #103 Dev server on 127.0.0.1 · #95 Weekly encrypted local backup — S

**Next — trust, then the differentiators**
13. #74 AI switch per learner, child-safety prompts — M
14. #73 Streak reminders that sell the dream, not threats — S
15. #49 "My answer should be accepted" reports — M (after #63)
16. #53 Your mistakes, made visible — L (after #63)
17. #51 Dictation — M · #55 Listening cards — S · #54 Speak your reply — M · #56 Writing task — M
18. #52 Dashboard phase 2: learning measures — M (after #109)
19. #100 Certificates say what the course practised — S · #99 Gloss check — M

**Then — levels**
20. #57 B1 guided path, all four languages — L (after the differentiators; French checked by a native speaker)
21. B2 (to be filed when B1 is under way)
22. #61 Weekly recap — S

**Later**
23. #59 Practice exam sections at A2 and B1 — L
24. #58 Graded readers — L, then #122 Cartoon clips (parked; reuses #58's scripts)
25. #60 Engagement experiments (no loss framing — owner's rule, #73) — M
26. #62 Move to the custom domain — S (after the owner sets up DNS)
27. #65 Foundations for new writing systems and grammars — M
28. #66 German A1 pilot — L
29. #64 Triage legacy CLI issues — S (owner decides what to close)

**Waiting on the owner:** nothing (2026-10-23). Railway's "Wait for CI" is on
(#71, closed), and the Anthropic key has a $20/month spend limit (#123).

Done and closed: #35–#38 (guided path phases 1–4), #40–#47 (sounds, language
chooser, group leaderboards, PWA, streak reminders), #48 (CI), #87 (typo notes
keep accents), #50 (content cleanup), #70 (endings), #91 (level-page counts).
