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
- Strict, explained grading (accents, pronouns, whole words; endings only
  partly — #70); answer sounds; pronunciation by the device voice.
- Installable as an app (PWA); streak reminders after 2, 5 and 12 quiet days;
  streaks are never lost.
- Optional AI tools (conversation, generated drills) on the cheapest model.
- CI on every pull request: typecheck, tests (content tests included),
  curriculum and vocabulary checks, and the production build (#48).

**Known gaps and issues**
- Grading: a wrong ending that shares its last letter with the right one is
  forgiven as a typo (*cansados* for *cansadas*) (#70).
- Progress safety: the level page's Words/Phrases/Grammar bars shrink when
  content is added (#91); fixing a word's spelling orphans learners' progress
  on it (#93); words added to a finished unit never reach those learners (#90).
- The path stops at A2 — no B1 yet (#57).
- Stricter grading will reject some fine answers that aren't listed; there's
  no way for a learner to flag them yet (#49).
- Content writers' notes: French done; Italian, Spanish and Portuguese are in
  review and ship with #91 (#50). Two related bugs: fill-in-the-blank borrows
  sentences where a word means something else (#82); Spanish *a* is treated
  as an article in the course dedupe (#85).
- No analytics, so no way to see what helps (#52).
- Writing, dictation, speaking aloud and reading — four of the vision's
  promises — aren't built yet (#51, #54, #56, #58).
- No account deletion or privacy page (#63). Still on the Railway URL while a
  domain is chosen (#62).
- On iPhone, the installed app keeps its own login (platform behaviour).
- The legacy Python CLI's issues (#7–#27) are mostly stale (#64).

## Next up

Roughly in order; each line is one or a few PRs. The board is the record:
`stage: ready` issues are designed and through Socrates; `Blocked by:` lines
set the order where it matters.

**Now — accuracy and progress safety (bugs first)**
1. #91 Level page shows counts, so bars never shrink — S (then #50's last three PRs)
2. #70 A wrong ending is a mistake, not a typo — M
3. #93 Item keys survive content edits (lock + renames) — M
4. #82 Fill-in-the-blank: no borrowed homographs — S
5. #85 Articles per language in the course dedupe — S
6. #90 "What's new since you finished" — L (after #93)
7. #51 Dictation: listen, then type — M
8. #80, #81 CI: pinned Python deps, Docker build — S · #95 Weekly encrypted local backup — S (owner sets it up)

**Next — trust, then the differentiators**
9. #63 Privacy page, account deletion, housekeeping — M
10. #49 "My answer should be accepted" reports — M (after #63)
11. #76 Password reset without email — M (after #63)
12. #52 Learning events and the dashboard (full build) — M (after #49, #63)
13. #53 Your mistakes, made visible — L (after #70, #63)
14. #72 Front page and invite copy — S (after the readiness kit, #69)
15. #54 Speak your reply — M · #55 Listening cards — S · #56 Writing task — M
16. #57 B1 guided path, all four languages — L
17. #61 Weekly recap — S

**Later — proof of level, engagement, new languages**
18. #59 Practice exam sections at A2 and B1 — L
19. #58 Graded readers — L
20. #60 Engagement experiments (contextual bandits) — M
21. #62 Move to the custom domain — S (after the owner sets up DNS)
22. #65 Foundations for new writing systems and grammars — M
23. #66 German A1 pilot — L
24. #64 Triage legacy CLI issues — S (owner decides what to close)

**Waiting on the owner:** #71 (CI required to merge), #73 (reminder wording),
#74 (kids and the AI tools), #75 (marketing's numbers), #77 (turn on Railway's
7-day backups — decided, the setting is the owner's).

Done and closed: #35–#38 (guided path phases 1–4), #40–#47 (sounds, language
chooser, group leaderboards, PWA, streak reminders), #48 (CI), #87 (typo notes
keep accents).
