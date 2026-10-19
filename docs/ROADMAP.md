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

**Now — accuracy and progress safety (bugs first)**
1. #93 Item keys survive content edits (lock + renames) — M
2. #107 Neutral ending note · #82 Cloze homographs · #85 Articles per language — S
3. #101 Multi-word nouns with their article · #104 Noun genders (after #99) — S/M
4. #105 Endings gap-finder, then forgive end-of-word typos again — M · #106 Different-word typos — S
5. #90 "What's new since you finished" — L (after #93)
6. #80, #81 CI hardening · #103 Dev server on 127.0.0.1 · #95 Weekly encrypted local backup — S

**Next — trust, then the differentiators**
7. #63 Privacy page, account deletion, housekeeping — M
8. #74 AI switch per learner, child-safety prompts — M
9. #73 Streak reminders that sell the dream, not threats — S
10. #49 "My answer should be accepted" reports — M (after #63)
11. #76 Password reset without email — M (after #63)
12. #53 Your mistakes, made visible — L (after #63)
13. #51 Dictation — M · #55 Listening cards — S · #54 Speak your reply — M · #56 Writing task — M
14. #52 Learning events and the dashboard (full build) — M (after #49, #63)
15. #100 Certificates say what the course practised — S · #99 Gloss check — M
16. #72 Front page and invite copy — S (after the readiness kit, #69)

**Then — levels**
17. #57 B1 guided path, all four languages — L (after the differentiators; French checked by a native speaker)
18. B2 (to be filed when B1 is under way)
19. #61 Weekly recap — S

**Later**
20. #59 Practice exam sections at A2 and B1 — L
21. #58 Graded readers — L
22. #60 Engagement experiments (no loss framing — owner's rule, #73) — M
23. #62 Move to the custom domain — S (after the owner sets up DNS)
24. #65 Foundations for new writing systems and grammars — M
25. #66 German A1 pilot — L
26. #64 Triage legacy CLI issues — S (owner decides what to close)

**Waiting on the owner:** Railway's "Wait for CI" toggle (#71); the one-line
AI disclosure inside AI screens (#74).

Done and closed: #35–#38 (guided path phases 1–4), #40–#47 (sounds, language
chooser, group leaderboards, PWA, streak reminders), #48 (CI), #87 (typo notes
keep accents), #50 (content cleanup), #70 (endings), #91 (level-page counts).
