# Pipeline — what we shipped, what we said it would do, and whether it did

Each session starts here: re-read the last entry's bets and check them.
Totals only, and a count of 1 or 2 is written "<3" (this repo is public; see
CHANNELS.md).

## Readiness (exists / doesn't)

| Artifact | State on 2026-10-15 |
|---|---|
| Landing page (`/`) | Exists but off-message: "AI language practice", lists AI-made exercises, not the course. Draft replacement → #72. |
| One-page "What is Langue" | Draft (`drafts/what-is-langue.md`, PR for #69). |
| Invite message people forward | Exists in the app but off-message ("AI tutor"). Draft replacement → #72. Short chat version drafted. |
| Weekly "what's new" | First draft (`drafts/whats-new-2026-10-15.md`), refreshed 2026-10-16 to cover everything deployed 13–16 October. |
| FAQ for new learners and parents | Draft (`drafts/faq.md`). Four answers depend on open issues (#73, #74, #76, #63). |
| `POSITIONING.md` with sources | Done for everything live on `main` @ 4f00646. |
| LinkedIn posts and invite message (campaign 002) | Draft (`drafts/linkedin-posts.md`, #124). |
| README (what a reader of LinkedIn post 1 lands on) | ✅ Applied: #127 (12c3847, 2026-10-23) puts `drafts/linkedin-posts.md` §4 on top, word for word. At post 2, drop "for family and friends", as the front page does (#130). |

## The plan (the owner, 2026-10-20, #124)

Free pre-alpha marketing, in three rings. Each opens only when the last one
keeps people. No money is spent; the real costs are the owner's time and
Anthropic usage (capped by #123 once it ships).

| Ring | What | Opens when | State |
|---|---|---|---|
| **1. Personal invites** | Campaign 001: 15 people from the owner's circle with a reason to learn | #109 PR 1 and #72 deployed | Brief merged (#113); not launched |
| **2. LinkedIn** | Campaign 002: post 1 tells how Langue is built (no invite); post 2 opens 25 places, invited by private message | Post 1: #126 (the README) merged. Post 2: 001's day-14 read, #109 PR 1 and 2, #72, #123 (or an Anthropic spend limit), #63, #76 | Drafted (#124) |
| **3. Reddit** | Not drafted. Listen first: what beginners say about forgiven typos, streak pressure and grammar is message material | 001 and 002 both reach "do more"; #49 (report a grading) live; the owner has read each subreddit's rules; posts come from the owner's own account and say AI wrote the course | Listening |

**Not now:** Hacker News and Product Hunt. They'd bring a burst of hundreds of
builders: the wrong audience, and uncapped AI cost until #123. Nothing paid.

**Nothing is automated.** Marketing drafts; the owner posts, replies and
sends (CHANNELS.md).

## Numbers

**No user data until #52's dashboard (owner, #75).** The owner, 2026-10-16:
"Marketing can keep working without a dashboard, it just doesn't need to have
user data until the dashboard is ready is all." So marketing continues
(drafts, positioning, materials), but with no numbers and no `funnel.sql`
runs until #52, and materials stay general. (2026-10-15: marketing can't
read production, correctly.) `funnel.sql` is ready and checked against the local database: it runs;
a probe learner with no practice shows up as `never_practised`; counts of 1
or 2 print as "<3"; and an INSERT added to it is refused ("cannot execute
INSERT in a read-only transaction").

When the first run comes in, record here **only the PASTEABLE sections
(§1–§7)**, as printed: learners; joined in the last 7 and 30 days; practising
in the last 7 days; of those who joined 14+ days ago, how many practised in
the last 7 days; codes made, used and with someone practising; languages;
guided path vs. AI tools; learners with reminders on. A count of 1 or 2 is
written "<3" (funnel.sql does it). §8–§9 are owner's eyes only and never go
in the repo or an issue.

## Feedback turned into issues

None relayed yet. Found while checking claims instead:
- #70: grading passes wrong agreement and tense endings as typos. **Fixed by #102, deployed 2026-10-16 (a81c9cb)**; the endings claim is now LIVE.
- #72: front page and invite email call Langue an "AI tutor".
- #73: reminders warn of a streak loss that can't happen. **Owner decided 2026-10-16: gain framing, no threats** (also binds #60); not shipped yet.
- #74 (needs-owner): should child learners see the AI tools?
- #75 (needs-owner): how marketing gets its numbers.
- #76: no way back in after a forgotten password.

## Bets (waiting on #52's dashboard; owner, #75)

These need user data, so they wait. The rest of marketing doesn't. Keep them as
the plan for when the dashboard exists.

1. **The new invite message gets people in and keeps them.** Measure, two
   weeks after the owner starts sending it (by #72 or by pasting): codes sent →
   joined → still practising at two weeks. No target yet: there's no
   baseline. The first run sets one.
2. **The FAQ answers what newcomers ask.** Measure: questions the owner gets
   from new people in their first week that the FAQ already answers (FAQ not
   read or not found) vs. doesn't (FAQ gap → add it).
3. **The what's-new note brings back quiet learners.** Measure: practising in
   the last 7 days, the week before vs. the week after it's posted
   (funnel.sql §2). Small numbers, so read it as a hint, not a result.
4. **The building story brings learners, not just the curious.** Measure:
   002's week-2 rate against 001's, on their codes' #109 rows. Small numbers,
   so read it as a hint. If it's far lower, tighten the invite question
   before 003.
