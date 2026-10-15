# Draft — FAQ for new learners and for parents

**For:** people who've just been invited, and parents of kids who use
Langue. Written to adults. **Where it goes:** the owner can send it as a
message or document now. An in-app FAQ page would be a separate issue,
filed only if the owner wants one. **Status:** draft, not sent.

Questions marked ⚠ have honest answers the owner may want to change by
fixing the app first: #73, #74, #76.

---

## For new learners

**What is Langue?**
A language course in short daily steps, where you type the answers
yourself. It's small and invite-only, for family and friends. (The one-page
"What is Langue" says more.)

**Which languages and levels?**
Italian, Spanish, French and Brazilian Portuguese. Beginner (A1) and
Elementary (A2) are complete in all four. Higher levels aren't built yet.

**How much time does it take?**
Each step is planned for about three minutes; do one or several. Each level
has ten units. They're designed for about a week each at a steady pace, but
nothing is timed, so go at yours.

**I already know some. Do I start from zero?**
No. On the level page you can test out of the units you know.

**Why was my answer marked "close"?**
You had a small slip in a longer word, or a missing or wrong accent. You'll
see the right spelling, and it still counts as right.

**My answer was right, but it was marked wrong.**
That happens: the course lists the answers it accepts, and it can miss a
good one. There's no report button yet, so please send the person who
invited you the question and what you typed. That's how the course gets
fixed.

**What's a streak here?**
The number of days you've practised. Taking a break never resets it.

**Will it nag me?** ⚠
Only if you turn reminders on. Then you get one after two quiet days, then
after five, then after twelve, always in the early evening, and then no
more until you practise again. *(The reminder wording still talks about a
streak "slipping". It can't slip. Whether to change that wording is the
owner's call: #73.)*

**Can several people use one phone or tablet?**
Yes. Sign in, then add another learner; tap the name at the top to switch.

**How do I put it on my home screen?**
On iPhone or iPad, in Safari: tap Share, then Add to Home Screen. On Android,
Chrome offers an Install button. On iPhone the home-screen app keeps its
own login, so you sign in once more inside it.

**Does Langue use AI?**
The course doesn't. Lessons, steps, role-plays, grading, reviews and
reminders are fixed content and plain code. Some optional extra tools do use
AI (Anthropic's small Claude model): the Conversation partner, the Reading,
Translation and Fill-in-the-blank exercises, "ask about this lesson", and
the explanation you get when you miss a flashcard. What you type into those
tools is sent to Anthropic. AI-written exercises aren't checked the way the
course is.

**I forgot my password.** ⚠
There's no "forgot password" button yet, so save your password in your
phone's password manager when you sign up. If you're locked out, tell the
person who invited you. *(#76.)*

**Does it cost anything?**
There's nothing to pay and there are no ads.

## For parents

**Is Langue for children?**
It's built for adults and for kids from about ten, learning together in
small family-and-friends groups. You join only with an invite code. Please
set your child up yourself.

**What does my child need to sign up?**
A name, an email address and a password. The name is shown to their group,
so a first name or nickname is fine. Each account needs its own email
address. Langue never sends email, so it's only used to sign in. Many email
providers (Gmail, for example) let you add `+name` to your own address for
this.

**Who can see my child, and what do they see?**
People in the same invite group see your child's name, points, streak and
level badges on the group's leaderboard, and nothing else. There's no way
to message other learners. The person who runs Langue can see accounts, as
with any app.

**Will my child talk to an AI?** ⚠
Not in the course. The optional extra tools above (the Conversation partner
and some exercises) use AI, and today any account can open them. There's no
parental switch for them yet. What's typed into them is sent to Anthropic.
*(Decision pending: #74.)*

**Will it pressure my child to keep going?**
We've tried hard not to. Streaks are never taken away, progress bars only go
up, there are no lives or hearts, and reminders come only if you turn them
on, at most three times, and then stop.

**Ads, purchases, data?**
No ads and nothing to buy. Langue doesn't sell data. A full privacy page
isn't written yet (#63); until then, ask the person who invited you
anything.

**Can I delete my child's account?** ⚠
Not from the app yet; a "delete my account" button is planned (#63).
Ask the person who runs Langue and they'll delete it. *(Owner: confirm
you're happy to do this by hand until #63 ships.)*

**Is there a time limit or parental control?**
No. There are no screen-time controls in the app. Steps are short, and
there's no penalty for stopping.

---

## Sources, line by line

```
CLAIM: "Italian, Spanish, French and Brazilian Portuguese … A1 and A2 complete …
Higher levels aren't built yet"
SOURCE: curriculum:check; data/curriculum/README.md l.27; docs/ROADMAP.md. Verified.

CLAIM: "Each step is planned for about three minutes … ten units … designed for about
a week each"
SOURCE: planner.ts STEP_SECONDS = 180; level.yaml units: (10 per level);
data/curriculum/README.md "ten steps a motivated learner can finish in about a week
each". Design intent, said as such. Verified.

CLAIM: "test out of the units you know"
SOURCE: learn/level/page.tsx. Verified.

CLAIM: "small slip in a longer word, or a missing or wrong accent … it still counts as
right"
SOURCE: grade.ts typoOf (no typos on words of 3 letters or fewer) and
gradeTargetAnswer; schedule.ts applyAnswer "A close answer … counts as right";
grade.test.ts. Verified.
NOTE: today "close" also covers wrong agreement/tense endings that share a last
letter (#70). The FAQ doesn't promise endings are caught.

CLAIM: "There's no report button yet"
SOURCE: #49 is in stage: questions; no report route in web/src/app/api. Verified.

CLAIM: "The number of days you've practised. Taking a break never resets it."
SOURCE: standings.ts nextStreak (+1 on any new day) / liveStreak. Verified.

CLAIM: "one after two quiet days, then after five, then after twelve, always in the
early evening, and then no more until you practise again"
SOURCE: reminders.ts REMINDER_DAYS, EVENING_FROM 17 / EVENING_TO 20, reminderDue
(none after the last; schedule restarts after practice). Opt-in: pwa.tsx
ReminderToggle. Verified.

CLAIM: "add another learner; tap the name at the top to switch"
SOURCE: components/device-accounts-note.tsx ("switch between learners by tapping the
name at the top of the screen"). Verified.

CLAIM: "On iPhone or iPad, in Safari: tap Share, then Add to Home Screen. On Android,
Chrome offers an Install button … keeps its own login"
SOURCE: components/pwa.tsx InstallHint; docs/ROADMAP.md "On iPhone, the installed app
keeps its own login". Verified.

CLAIM: AI answer (course doesn't; which tools do; Anthropic; typed text sent; AI
exercises not checked like the course)
SOURCE: model importers (app/api/chat, app/api/lessons/ask, lib/engine/activities.ts
via exercises, exercises/grade, flashcards/answer); model.ts claude-haiku-4-5; content
checks cover data/curriculum only. Verified.

CLAIM: "There's no 'forgot password' button yet"
SOURCE: no reset flow, no mail library; passwordHash written only at registration
(lib/auth/actions.ts). Verified. Filed #76.

CLAIM: "nothing to pay and there are no ads"
SOURCE: grep of web/src and web/package.json; vision. Verified.

CLAIM: "built for adults and for kids from about ten"
SOURCE: docs/vision.md "Who it's for". Verified (it's a design intent).

CLAIM: "A name, an email address and a password … Each account needs its own email
address. Langue never sends email."
SOURCE: RegisterSchema (lib/auth/actions.ts); User.email @unique (schema.prisma); no
mail library. Verified.

CLAIM: "+name" addressing
SOURCE: general knowledge of Gmail. Only "for example, Gmail" is claimed; the reviewer
may cut the line.

CLAIM: "name, points, streak and level badges … nothing else … no way to message"
SOURCE: Standing in standings.ts; no messaging model or route. Verified.

CLAIM: "today any account can open them. There's no parental switch"
SOURCE: no per-account AI setting in schema.prisma User; tools on the home menu for
everyone (learn/page.tsx ACTIVITIES). Verified. #74.

CLAIM: "no lives or hearts … at most three times"
SOURCE: grep (no such mechanic); REMINDER_DAYS has three entries. Verified.

CLAIM: "Langue doesn't sell data"
SOURCE: docs/vision.md "What we won't do". Privacy wording otherwise waits for #63.

CLAIM: "a 'delete my account' button is planned (#63) … Ask the person who runs
Langue and they'll delete it"
SOURCE: #63 is open, labelled stage: questions (checked 2026-10-15) and on the roadmap. The by-hand deletion is the
owner's call. OWNER TO CONFIRM.

CLAIM: "There are no screen-time controls in the app"
SOURCE: no such setting in schema.prisma User or the settings actions. Verified.
```
