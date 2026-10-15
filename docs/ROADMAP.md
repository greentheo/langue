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
- Strict, explained grading (accents, endings, pronouns); answer sounds;
  pronunciation by the device voice.
- Installable as an app (PWA); streak reminders after 2, 5 and 12 quiet days;
  streaks are never lost.
- Optional AI tools (conversation, generated drills) on the cheapest model.
- CI on every pull request: typecheck, tests (content tests included),
  curriculum and vocabulary checks, and the production build (#48).

**Known gaps and issues**
- The path stops at A2 — no B1 yet (#57).
- Stricter grading will reject some fine answers that aren't listed; there's
  no way for a learner to flag them yet (#49).
- Content writers' notes still open: wasted duplicate vocabulary entries,
  level mismatches, a few confusable pairs, uneven unit sizes (#50).
- No analytics, so no way to see what helps (#52).
- Writing, dictation, speaking aloud and reading — four of the vision's
  promises — aren't built yet (#51, #54, #56, #58).
- No account deletion or privacy page (#63). Still on the Railway URL while a
  domain is chosen (#62).
- On iPhone, the installed app keeps its own login (platform behaviour).
- The legacy Python CLI's issues (#7–#27) are mostly stale (#64).

## Next up

Roughly in order; each line is one or a few PRs.

**Now — accuracy, and the basics that keep it safe**
1. #48 CI for the web app — S
2. #49 "My answer should be accepted" reports — S
3. #50 Content cleanup from the writers' notes — S
4. #51 Dictation: listen, then type — M
5. #52 Learning events and a small dashboard — M

**Next — the differentiators**
6. #53 Your mistakes, made visible (mistake categories, top-3, drills) — L
7. #54 Speak your reply (speech recognition in role-plays) — M
8. #55 Listening cards — S
9. #56 Writing task per unit, corrected (optional AI) — M
10. #57 B1 guided path, all four languages — L
11. #61 Weekly recap — S

**Later — proof of level, engagement, new languages**
12. #59 Practice exam sections at A2 and B1 — L
13. #58 Graded readers — L
14. #60 Engagement experiments (contextual bandits) — M
15. #63 Delete my account + privacy page — S
16. #62 Move to the custom domain — S (after the owner sets up DNS)
17. #65 Foundations for new writing systems and grammars — M
18. #66 German A1 pilot — L
19. #64 Triage legacy CLI issues — S (owner decides what to close)

Done and closed: #35–#38 (guided path phases 1–4), #40–#47 (sounds, language
chooser, group leaderboards, PWA, streak reminders).
