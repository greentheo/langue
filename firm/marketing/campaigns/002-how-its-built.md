# Campaign 002: how it's built

**Status:** draft brief for #124. Nothing is posted or sent; posting is the
owner's call. The posts and the invite message are in
`drafts/linkedin-posts.md`.

**In one paragraph:** the owner tells the true story of how Langue is made on
their own LinkedIn: a small firm of AI agents builds it, and they spend 10–20
minutes a day as its owner. Post 1 tells the story and invites nothing.
People who want in send a message, and the owner's LinkedIn inbox is the
waiting list. Once the gates below are live, post 2 opens 25 places, and the
owner sends each invite by private message from one campaign code. Two weeks
after the code closes, #109's dashboard says whether to do more, change the
story, stop and fix the app, or wait because it's too few to judge.

**The owner's decisions (2026-10-20, in marketing's session, #124):**
- open Langue to people they don't know: "Yes, capped", after campaign 001;
- the story: "How it's built";
- an AI cap before strangers arrive (#123).

---

## Who it's for, and why them

**For:** adults in the owner's LinkedIn network, and the people they share
it with, who
- have a concrete reason to learn Italian, Spanish, French or Brazilian
  Portuguese: a trip, a partner's or family's language, heritage, a move, work;
  and
- are beginners or rusty: the course today is A1 and A2.

**Why them:**
- **They're 001's audience, one ring out.** The vision's "Who it's for" is
  people who want to *use* a language. 001 asks whether people with a reason
  stay; 002 asks whether that still holds for people the owner doesn't know
  well.
- **The story is true, distinctive and checkable.** The repo is public, so
  anyone can read the designs, the reviews and the arguments.

**Expect, and filter:** the story will draw builders who are curious about the
agents more than about a language. They're welcome to read everything in the
repo, but the invite is for learners. The owner asks one question before
sending a code: *"Which language, and what's it for?"* Anyone without an
answer gets the repo link, not an invite. Otherwise, their week-2 drop-off
would read as a verdict on the app.

**Not for:**
- **Children.** Never marketed to. LinkedIn is a professional network, and
  each invite is sent one by one by the owner. A parent who asks for a child
  gets a separate family code (as in 001), never this one.
- **People who mainly want speaking practice.** Speaking aloud isn't built
  (#54).
- **People already on Langue, testers and builders.** They'd blur the read.

## The message

Three pieces, all in `drafts/linkedin-posts.md` with sources:
1. **Post 1, the story.** The five seats, the owner's 10–20 minutes, one true
   moment (the reviewer catching marketing's own French claim), and the
   honest line on who wrote the course. It ends with "send me a message"
   and no code.
2. **Post 2, the cohort opens.** 25 places for beginners with a reason, what
   the course is and isn't, and "it's pre-alpha".
3. **The invite message,** sent privately to each person. It's 001's body,
   adjusted for strangers: the group is "me and others who came from my
   post", it's pre-alpha, the code is "open until {day}", the link is "just
   for you", and it links to `/privacy`.

**Depends on:**
- **#114 (PR #120):** the endings line says "(so are some missing
  accents)", as in 001, never the bare "a wrong ending is marked wrong"
  (Spanish *hable* for *hablé* still counts). Post 1's moment says the fix
  "is in review"; refresh it to "fixed" once #120 has shipped.
- **#123:** the invite message says nothing about AI limits. If a learner
  hits one, the app says so (#123's scope 5).

## The channel

- **Posts** go on the owner's own LinkedIn account, posted by the owner.
- **Invites** go only as private LinkedIn messages, one person at a time,
  from the owner. Never put the code or the invite link in a post, a
  comment, or a group message: anyone holding the link can use the code
  until it runs out.
- **Replies** are the owner's own. Marketing drafts on request: the owner
  pastes a comment without the commenter's name, and marketing drafts a
  reply. Nothing is automated (LinkedIn User Agreement §8.2; MARKETING.md).

## The code

Made by the owner on `/learn/invites` on day 0:

| Setting | Value | Why |
|---|---|---|
| **Uses** | **25** | The cap limits AI cost, password resets and support to what the owner can handle at 10–20 minutes a day. **The code is made with 25 uses, so the app turns away a 26th signup** ("That invite code has been used by everyone it was made for"). So the owner sends **at most 25 invites**, never more, and everyone else who asked is first for 003. 25 can reach #109's 5 signups even if four in five people invited never join. |
| **Expires** | **7 days** | The week runs from when the code is made (`lib/auth/invites.ts` l.49–51), not from each invite, so the message says "open until {day}". As in 001, every signup lands in week 1, and the cohort reads clean by day 21. People who ask later go on the inbox waiting list for 003. |
| **Note** | **"Early learners"** | The note is the group's name, so every member sees it (`lib/leaderboard.ts`). It's also the dashboard label. It names the campaign, never a person or the channel's source, and it must differ from 001's "Autumn starters". |

The owner's LinkedIn inbox is the list of who asked and who was invited. It
never goes in the repo or an issue. Marketing needs only counts: messages
asking for an invite, invites sent.

## When to launch

**Post 1 (the story, no invite) can go out once:**
1. ✅ **#126 is merged (the README):** #127, 12c3847, 2026-10-23. The post
   links the repo, and its README used to open "Langue - AI Language
   Learning" and list levels A1–C2 (the old CLI's flashcard libraries, not
   the course). It now opens with `drafts/linkedin-posts.md` §4, word for
   word. At post 2, drop its "for family and friends", as the front page
   does (#130).
2. ✅ **#72 is deployed** (#128, 8f7d6e1, 2026-10-26), so the post may name the app's address. Readers
   who look Langue up no longer land on "AI language practice".

Post 1 hands out nothing, so it can run while 001 does.

**Post 2 and the invites wait for all of these:**

| Gate | Why it's a gate for strangers | State (2026-10-26) |
|---|---|---|
| **001's day-14 read shows no first-run problem:** on 001's row, activated is at least 60% of signups. If 001 has no row (fewer than 5 signups, or pooled by the dashboard), the owner has heard of no one getting stuck. | Don't hand a known leak to people who don't know us. | 001 not launched |
| **#109 PR 1 and PR 2 deployed** | Without the funnel, 002 can't be read. | ✅ Deployed (#115, #117; 8f7d6e1) |
| **#72 deployed** | First contact must not say "AI tutor". | ✅ Deployed (#128; 8f7d6e1) |
| **#123 deployed, or at least a monthly spend limit on the Anthropic key** (the owner sets it in Anthropic's console, no code needed) | Nothing caps a learner's AI use today, and AI is on by default (#74). | Needs owner |
| **#63 deployed** (age checkbox, delete account, full privacy page) | Strangers need to know what's kept and be able to leave. Kids use Langue, and the checkbox asks. | Ready, no longer blocked (#109 shipped) |
| **#76 deployed** (password reset) | Today a stranger who forgets their password has no way back, and the owner can't reset it either. A lost login would read as "didn't stay". | Ready, not built |

The foreman's view matches (2026-10-20). Night shift's queue doesn't include
#72, #63, #76 or #123 yet, and reordering it is the owner's call.

| Day | What | Owner's time |
|---|---|---|
| any time after its gates | Post 1 | ~10 min |
| 0 | Post 2; mint the code; invite the first people on the waiting list who answered the question, **25 at most**; tell the rest they're first for 003 | ~30 min |
| 0–7 | Invite new askers as they answer, until 25 invites have gone out | ~5 min a day |
| 7 | The code expires | — |
| 14 | First read | 2 min |
| 21 | Final read; decide | 2 min |

## Success measure and decision rule

**Measured in #109's funnel, on this code's own row:** invite opened →
signed up → activated → week-2 active. **Above the funnel, from LinkedIn,**
the owner reports counts only: each post's impressions and reactions (LinkedIn's
own post analytics), messages asking for an invite, and invites sent.

**What the owner can see.** `/learn/invites` always shows the code's uses
("{useCount}/{maxUses} used"). The dashboard decides whether the code gets its
own row, and 5 signups aren't always enough: under #117's privacy rule, a
code is pooled whenever the other people who signed up in the same window
number 1–4. One small family code is enough for that. Each rule below uses
only what's on the page.

**Read top to bottom; the first row that matches decides:**

| When | If… | Then |
|---|---|---|
| **Day 14** | **Fewer than 5 signed up**, read from the code's uses on `/learn/invites` | **Change the story.** If few people asked, post 1 didn't reach learners: try the app itself (endings count) for 003. If many asked but few joined, look at the invite message and the sign-up page. |
| **Day 21** | **The code has no row of its own** (pooled, even with 5+ signups) | **Too few to judge.** Keep the story and the cap, and run 003 at the same size. Record the signups from `/learn/invites`, and "pooled". |
| **Day 21** | **A tripwire is tripped on the code's row:** activated under 60% of signups, or week 2 under 40% of activated | **Stop, and fix the app first.** The tripped tripwire names the stage (first run, or onboarding and reminders). Marketing files what the row shows as an issue. Campaigns restart when the fix ships. |
| **Day 21** | **5 or more week-2 active** | **Do more.** 003: the next post, with a bigger cap (50) if the owner's time held up. |
| **Day 21** | **Anything else:** 5 or more signed up, fewer than 5 week-2 active, and no tripwire tripped | **Too few to judge.** A small cohort that's healthy so far (e.g. 7 signed up, 6 activated, 4 in week 2). Keep the cap and run 003 at the same size. |

**Also look at, but don't decide on:**
- **002 against 001.** If 002's week-2 rate is far below 001's, the story
  draws the curious, not learners: tighten the question before 003.
  The numbers are small, so read it as a hint.
- **#123's "codes that hit C" line** (once #123 is live), beside week 2: a
  low week 2 can be the AI limit, not the message (foreman, 2026-10-20).
- **What people say in comments and messages.** The owner relays it without
  names; marketing turns each fix into an issue.

## What we record

In `PIPELINE.md`, after each read: the LinkedIn counts above, the number of
invites sent, and the row's counts as the dashboard shows them, with any 1
or 2 written "<3". Then the decision and why. Nothing about any one person.

---

## Sources, line by line

```
CLAIM: "the owner's decisions (2026-10-20)"
SOURCE: the owner's answers in marketing's session, 2026-10-20, recorded on #124.
Verified (told to marketing directly, not relayed).

CLAIM: "Speaking aloud isn't built (#54)"; "the course today is A1 and A2"
SOURCE: as in 001's sources. Verified.

CLAIM: Gate states: #115/#117 in review, #72 ready not built, #63 blocked by #109,
#76 ready not built, #123 needs-owner, night shift's queue
SOURCE: gh issue/pr views, 2026-10-20; foreman's message to marketing, 2026-10-20
(night shift's order: #115/#117/#120 fixes → #119 → #118 → #93). Re-check on launch day.

CLAIM: "Nothing caps a learner's AI use today, and AI is on by default (#74)"
SOURCE: #123 body (per-request caps only: 24 turns, 4,000 characters, 700 tokens;
app/api/chat/route.ts); lib/auth/actions.ts header comment; #74 owner decision.
Verified.

CLAIM: "a stranger who forgets their password has no way back, and the owner can't
reset it either"
SOURCE: #76 open; foreman, 2026-10-20 ("the owner has no tool to reset it either").
Verified against the board, not the code.

CLAIM: README "used to open 'Langue - AI Language Learning' and list levels A1–C2"
SOURCE: README.md lines 1 and 16–21 on main @ 84aa0f1. Verified. Replaced by #127
(12c3847): README.md l.1–20 on main match §4. Verified 2026-10-23.

CLAIM: front page says "AI language practice"
SOURCE: web/src/app/page.tsx l.36 (foreman, 2026-10-20); #72. Verified.

CLAIM: code settings, the note is the group's name, /learn/invites shows uses
SOURCE: as in 001's sources (lib/leaderboard.ts l.57; invites page form;
MAX_INVITE_USES = 100). Verified.

CLAIM: "LinkedIn User Agreement §8.2" bans automated posting, commenting, liking,
messaging
SOURCE: linkedin.com/help/linkedin/answer/a1341387 ("send or redirect messages,
create, comment on, like, share, or re-share posts", "the following prohibitions
listed in Section 8.2"). Fetched 2026-10-20.

CLAIM: #123's per-code allowance and "codes that hit C"
SOURCE: #123 design v3.1 (C = max(300, 50 × members)); foreman's message
2026-10-20. Design, not built.

CLAIM: "a code is pooled whenever the other people who signed up in the same window
number 1–4"; "/learn/invites always shows the code's uses"
SOURCE: PR #117's fixes (a0001c4: "A code gets its own row in a window only while
everyone else who signed up in that window … is 0 or ≥ 5"); the reviewer's re-check
and the foreman's decision (activated and week 2 in one window, all time), still with
night shift on 2026-10-20; learn/invites/page.tsx ("{useCount}/{maxUses} used"),
never suppressed. Design in review, not shipped: re-check against the live
dashboard before day 14. The "too few to judge" rows came from the reviewer (PR #125).
```
