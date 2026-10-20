# Campaign 001: a reason to learn

**Status:** draft brief for #112. Nothing is sent; launching is the owner's
call. **Stacked on #78:** the message and its claims come from #78's drafts
and POSITIONING. The owner approved #78 ("Looks good to me!", 2026-10-16),
and it isn't merged yet.

**In one paragraph:** the owner personally invites about 15 adults from their
own circle who have a real reason to learn Italian, Spanish, French or
Brazilian Portuguese. Everyone gets one shared campaign code, open for a
week. Two weeks after the code closes, #109's dashboard says whether to do
more of this, change the message, or stop and fix something in the app
first.

---

## Who it's for, and why them

**For:** adults the owner knows personally who
- have a concrete reason to learn one of the four languages: a trip, a
  partner's or family's language, heritage, a move, work; and
- are beginners or rusty: Langue's course today is A1 and A2.

**Why them:**
- **They're who Langue is built for.** The vision's "Who it's for" is
  people who want to *use* a language (travel, family, heritage, work, a
  move abroad) in small private groups.
- **A1–A2 is what exists.** Inviting someone at B1 or above invites them to
  a course that isn't there yet (B1 is #57), and their week-2 drop-off would
  tell us nothing about the message.
- **A personal invite is the only channel.** Langue is invite-only, and the
  owner sends personally (#75: kept general, no user data until the
  dashboard).
- **Our hypothesis, which this campaign tests:** people with a reason keep
  practising past week 1 more often than people who are just curious. One
  campaign can't prove it; it gives the first number.

**Not for:**
- **Children.** We never market to children. A parent who wants their child
  on Langue gets a separate family code from the owner, so the child's group
  is their own family's, not a leaderboard with adults they don't know.
- **People who mainly want conversation practice.** Speaking your replies
  aloud isn't built (#54).
- **Friends who are testing the app or helping build it.** Give them their
  own codes, so their use doesn't count as campaign results.

## The message

One personal line from the owner, then the body. It's the short chat version
from #78 (`drafts/invite-message.md` §2), widened for people learning a
different language from the owner's, and with the group explained.

> {**One line in the owner's own words: why they thought of this person.**
> For example, "You mentioned wanting your Spanish back before the trip in
> spring."}
>
> I've been learning {the owner's language} on Langue, a small invite-only
> app for family and friends. It teaches Italian, Spanish, French and
> Brazilian Portuguese, from beginner to elementary (A1 and A2): short daily
> steps where you type real answers, and a wrong ending is marked wrong (a
> missing accent is pointed out). No ads, nothing to pay.
>
> Here's your invite. The link fills in the code, and it's open for a week:
> {link}
>
> You'll be in a small group with a few others I've invited. The group sees
> each other's names, points, streaks and level badges on a leaderboard, so a
> first name or nickname is perfect. If someone in your family wants to join too, tell
> me and I'll send them their own invite.

**Depends on:**
- **#78 merged:** the claims' sources live in its POSITIONING.
- **#72 shipped before launch (a gate, below).** An invitee who taps "←
  Langue" on the sign-up page lands on the front page, which still says *"AI
  language practice"*.
- **Not on #114.** "(a missing accent is pointed out)" keeps the endings
  line true until #114 makes accent-only endings (French *parlé*) count as
  wrong. Drop the parenthesis once #114 is live.
- **Not on #73.** This version has no streak line. The email version (#78
  §1) does, so don't use it for this campaign until #73 ships.

## The channel

The owner sends each invite **personally**: a text, WhatsApp or email, one
person at a time. That's the personal line's job. No group messages, posts
or public places: anyone holding the link can use the code until it runs out.

## The code

Made by the owner on `/learn/invites`:

| Setting | Value | Why |
|---|---|---|
| **Uses** | **18** (15 invites + 3 spare) | The spares cover a few people the owner thinks of during the week. Family members get their own code, as the message says. #109 gives a code its own row only at ≥ 5 signups, so 15 invites can clear that bar even if two-thirds of people don't join. |
| **Expires** | **7 days** | Every signup lands in week 1, so everyone's week 2 has finished by day 21 and the cohort reads clean. Late joiners get a personal code, which is pooled and doesn't count here. |
| **Note** | **"Autumn starters"** | The note is **the group's name**: every member sees it on their home page and leaderboard (`lib/leaderboard.ts`: `name: code.note`). It's also the campaign's label on #109's dashboard. So it names the campaign, never a person, and reads well to the people in it. |

The owner keeps their own private list of who was invited. It never goes in
the repo or an issue. Marketing needs only the **number sent**.

## When to launch

**Gates (all three):**
1. **#109's eventing (PR 1) is deployed.** `invite.opened` and `signup` are
   then recorded from the first tap. The dashboard (PR 2) can follow, as
   long as it's live by day 14.
2. **#72 is deployed.** The front page no longer says "AI language
   practice".
3. **#78 is merged.**

**Then:** send all 15 on one day, ideally an evening (day 0). The code closes
on day 7.

| Day | What | Owner's time |
|---|---|---|
| 0 | Mint the code; send 15 personal messages | ~30 min |
| 7 | The code expires on its own | — |
| 14 | First read: signups are final and activation's window has closed | 2 min |
| 21 | Final read: everyone's week 2 is over; decide | 2 min |

## Success measure and decision rule

**Measured in #109's funnel, on this code's own row:** invite opened →
signed up → activated (finished a first step within 7 days) → week-2 active
(practised on any of days 7–13).

**Why the bars are counts of 5:**
- **Signups:** the code only gets its own row at 5 or more (#109), so 5 is
  the least we can measure the campaign by.
- **Week-2 active:** within the row every count is shown (#109, clarified
  2026-10-19). Here 5 is a choice, not a limit: a third of the 15 invited,
  still practising in their second week.

Neither is an industry benchmark. Campaign 001 sets our first baseline, and
002's bars come from it, finer if the numbers support it.

**Read top to bottom; the first row that matches decides:**

| When | If… | Then |
|---|---|---|
| **Day 14** | **Fewer than 5 signed up.** The code has no row of its own; the owner reads the code's uses on `/learn/invites`. | **Change the message.** Fewer than a third of people with a reason said yes. Rewrite the personal line and the body (and ask yourself whether the people were right), then run 002 with the new message to a new group. |
| **Day 21** | **5 or more week-2 active** (at least a third of the 15 still practising in their second week) | **Do more of this.** Campaign 002: the same message to the next group of similar people. |
| **Day 21** | **5 or more signed up, but fewer than 5 week-2 active** | **Stop, and fix the app first.** People came and didn't stay, so more invites would spend goodwill on a leak. #109's tripwires name the stage: *activated under 60% of signups* → first-run experience; *week-2 active under 40% of activated* → onboarding and reminders. Marketing files what the row shows as an issue. Campaigns restart when the fix ships. |

**Also look at, but don't decide on:**
- **Opened vs. signed up, as a rough sign only.** `invite.opened` counts a
  person once per *day* (#109), so someone who opens the link on three days
  counts three times, and the gap can come from repeat opens alone. Only if
  opens far outnumber signups *and* the owner hears that people got stuck
  on the sign-up page is it worth filing against first contact (#72's
  area), not the message.
- **#123's "codes that hit C" line,** once #123 is live, beside week 2: a
  low week 2 can be the code's shared daily AI limit, not the message
  (foreman, 2026-10-20).
- **What people say.** If the owner hears why someone didn't join or
  stopped, that's feedback. Marketing turns it into an issue with no name
  attached.

## What we record

In `PIPELINE.md`, after each read: the number sent, and the row's counts as
the dashboard shows them, with any 1 or 2 written "<3" (CHANNELS rule; the
repo is public). The decision and why go there too. Nothing about any one
person, ever.

---

## Sources, line by line

```
CLAIM (brief): "Langue's course today is A1 and A2"; "B1 is #57"
SOURCE: POSITIONING "Beginner (A1) and Elementary (A2) are complete…" (LIVE; counts on
a81c9cb); docs/ROADMAP.md. Verified.

CLAIM (brief): "Speaking your replies aloud isn't built (#54)"
SOURCE: #54 open; POSITIONING "Never say … speaking aloud". Verified.

CLAIM (message): "a small invite-only app for family and friends"
SOURCE: #78 invite-message.md §1/§2 source (InviteCode; register page "Registration is
invite-only"; vision "Who it's for"). Verified.

CLAIM (message): "It teaches Italian, Spanish, French and Brazilian Portuguese, from
beginner to elementary (A1 and A2)"
SOURCE: POSITIONING rows "Italian, Spanish, French and Brazilian Portuguese" and
"Beginner (A1) and Elementary (A2) are complete…". level.yaml titles
"Beginner"/"Elementary". Verified.

CLAIM (message): "short daily steps where you type real answers"
SOURCE: POSITIONING "Short steps, planned for about three minutes" and "You type real
answers…". Verified.

CLAIM (message): "a wrong ending is marked wrong (a missing accent is pointed out)"
SOURCE: POSITIONING endings row, LIVE since #102 (deployed a81c9cb; 13 #70 rows incorrect
both ways). The short form is allowed while the course stops at A2. Verified.
#114 CAVEAT: the parenthesis is required until #114 ships. French's commonest ending is
an accent, and "J'ai parle" for "parlé" is graded close (as are es hablo/habló and pt
pode/pôde; probe on ef01562). My first draft said the bare claim didn't contradict
limit (1) "since the message says nothing about accents". The reviewer showed it does,
for French. Real-word typos (#106) aren't touched: the message says nothing about
typos.

CLAIM (message): "No ads, nothing to pay"
SOURCE: POSITIONING "No ads, and nothing to pay" (grep of web/src, web/package.json).
Not "free forever". Verified.

CLAIM (message): "The link fills in the code, and it's open for a week"
SOURCE: register/page.tsx codeFromQuery (?code= prefills the field); the invite's
"Expires (days)" setting = 7 (learn/invites/page.tsx mintInvite). Verified.

CLAIM (message): "You'll be in a small group with a few others I've invited. The group
sees each other's names, points, streaks and level badges on a leaderboard"
SOURCE: lib/auth/actions.ts, registration's `groups: { create: { inviteCodeId } }`;
lib/auth/invites.ts l.67 (the code's creator, the owner, is in the group too);
lib/standings.ts Standing (displayName, weekPoints, totalPoints, streak, badges, e.g.
"IT A1", which tell the group which language someone learns). Verified. "a few others": 18 uses at most, plus the owner.

CLAIM (code): "The note is the group's name … members see it on their home page and
leaderboard"
SOURCE: lib/leaderboard.ts l.57 `name: code.note?.trim() || code.code`;
learn/page.tsx "This week · ${homeGroup.name}". Verified.

CLAIM (code): "Uses 18", "Expires 7 days"
SOURCE: lib/auth/invite-status.ts MAX_INVITE_USES = 100; invites page form (uses,
expires in days, 1–365). Verified.

CLAIM (measure): funnel stages, "activated (finished a first step within 7 days)",
"week-2 active (practised on any of days 7–13)", "a code's row appears at ≥ 5
signups", "within the row every count is shown", the tripwires (activated under 60%
of signups; week-2 under 40% of activated)
SOURCE: #109 v2 body (2026-10-19), scope 6, 7 (clarified the same day: stage counts
and rates are shown within a code's own row), 11. Verified against the issue, not the
code: #109 isn't built. Re-check against the shipped dashboard before day 14.

CLAIM (measure): "the owner reads the code's uses on /learn/invites"
SOURCE: learn/invites/page.tsx ("{useCount}/{maxUses} used"). Verified. It shows names
of who joined to the admin only, and marketing never sees or records those.
```
