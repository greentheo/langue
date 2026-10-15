# Pipeline — what we shipped, what we said it would do, and whether it did

Each session starts here: re-read the last entry's bets and check them.
Totals only (this repo is public; see CHANNELS.md).

## Readiness (exists / doesn't)

| Artifact | State on 2026-10-15 |
|---|---|
| Landing page (`/`) | Exists but off-message: "AI language practice", lists AI-made exercises, not the course. Draft replacement → #72. |
| One-page "What is Langue" | Draft (`drafts/what-is-langue.md`, PR for #69). |
| Invite message people forward | Exists in the app but off-message ("AI tutor"). Draft replacement → #72. Short chat version drafted. |
| Weekly "what's new" | First draft (`drafts/whats-new-2026-10-15.md`). |
| FAQ for new learners and parents | Draft (`drafts/faq.md`). Four answers depend on open issues (#73, #74, #76, #63). |
| `POSITIONING.md` with sources | Done for everything live on `main` @ 4f00646. |

## Numbers

**2026-10-15: unmeasured.** Marketing can't read production (correctly), and
the dashboard (#52) isn't built. Asked the owner how numbers should arrive:
#75. `funnel.sql` is ready and checked against the local database (it runs,
and a probe learner with no practice shows up as `never_practised`).

When the first run comes in, record here: learners; joined in the last 7 and
30 days; practising in the last 7 days; of those who joined 14+ days ago, how
many practised in the last 7 days; codes made vs. used; learners with
reminders on; the mix of guided path vs. AI tools.

## Feedback turned into issues

None relayed yet. Found while checking claims instead:
- #70: grading passes wrong agreement and tense endings as typos.
- #72: front page and invite email call Langue an "AI tutor".
- #73: reminders warn of a streak loss that can't happen.
- #74 (needs-owner): should child learners see the AI tools?
- #75 (needs-owner): how marketing gets its numbers.
- #76: no way back in after a forgotten password.

## Bets (check next session)

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
