# Draft — "What is Langue" (one page, and the new front page)

**For:** anyone deciding whether to join, and parents. **Doubles as** the
front page (`/`): #72 replaces the tagline and the Catalog and Activities
panels with this text, and keeps the banner, green screen and Sign in /
Redeem invite. **Status:** draft, not published.

Why it changes: today's front page says *"AI language practice on a green
screen"* and lists the older AI-made exercises, not the course people
actually use.

---

> **LANGUE**
>
> *A language course in short daily steps, where you type the answers
> yourself.*
>
> **What it teaches**
> Italian, Spanish, French and Brazilian Portuguese. Beginner (A1) and
> Elementary (A2) are complete in all four, about a thousand words in all.
> The levels are built on the CEFR, the European scale from A1 to C2, and
> each one comes with a list of what you'll be able to do. Higher levels
> aren't built yet.
>
> **How it works**
> - **Short steps.** Each step is planned for about three minutes. One
>   button picks the next one: something new, reviews that are due, and the
>   things you keep missing.
> - **You produce the language.** A new word climbs from recognising it, to
>   recalling it, to typing it, to using it in a sentence and in a role-play.
> - **Slips are pointed out.** A missing accent or a small typo is shown
>   with the right spelling, and still counts.
> - **Reviews come back** at growing intervals. A word counts as learned
>   when you've produced it on more than one day.
> - **Already know some?** Test out of the units you know. Each unit ends
>   with a level-up challenge, and each level with a certificate.
>
> **Kind by design**
> - Your streak is never taken away, and your progress through each unit
>   only goes up.
> - No lives, no ads, nothing to pay.
> - Reminders only if you turn them on: after two quiet days, then five, then
>   twelve, and then they stop.
> - Private groups. Each invite code is a group with its own leaderboard,
>   and there's no messaging between learners.
>
> **No AI in the course.** Lessons, steps, grading and reviews are fixed
> content and plain code. A few optional extra tools (a conversation
> partner, and some practice exercises) do use AI.
>
> **Not built yet:** speaking your answers aloud, dictation, writing tasks,
> and levels above A2.
>
> Langue is invite-only, for family and friends.
> **[Sign in]  [Redeem invite]**

---

## Sources, line by line

```
CLAIM: "A language course in short daily steps, where you type the answers yourself"
SOURCE: guided path (docs/guided-path.md); typed answers in steps/answer/route.ts
(type, cloze, reply, typed role-play turns). Verified. Picking exercises also exist,
which is why the copy says "you type the answers", not "you only type".

CLAIM: "Italian, Spanish, French and Brazilian Portuguese"
SOURCE: data/curriculum/*; Brazilian per data/curriculum/README.md l.27. Verified.

CLAIM: "Beginner (A1) and Elementary (A2) are complete in all four"
SOURCE: npm run curriculum:check: 15 lessons, 80–87 phrases, 16 role-plays for each
language and level; level.yaml titles "Beginner"/"Elementary". Verified.

CLAIM: "about a thousand words in all"
SOURCE: guided-path word items over A1+A2 from getCourse(): it 955, es 1006, fr 1077,
pt 1009. Verified. ("about" covers Italian's 955.)

CLAIM: "built on the CEFR, the European scale from A1 to C2 … a list of what you'll
be able to do"
SOURCE: level.yaml can_do lists. NOT certified. Wording per firm/MARKETING.md. Verified.

CLAIM: "Higher levels aren't built yet"
SOURCE: docs/ROADMAP.md (B1–C2 overview pages only). Verified.

CLAIM: "Each step is planned for about three minutes"
SOURCE: planner.ts STEP_SECONDS = 180. Verified (a plan, not a measurement).

CLAIM: "One button picks the next one: something new, reviews that are due, and the
things you keep missing"
SOURCE: docs/guided-path.md; planner.ts. Verified.

CLAIM: "A new word climbs from recognising it, to recalling it, to typing it, to
using it in a sentence and in a role-play"
SOURCE: modes recognize/recall/type/cloze/reply/turn in steps/answer/route.ts;
rungs in schedule.ts. Verified.

CLAIM: "Slips are pointed out. A missing accent or a small typo is shown with the
right spelling, and still counts."
SOURCE: grade.ts gradeTargetAnswer / typoOf; grade.test.ts; schedule.ts applyAnswer
("A close answer … counts as right"). Verified. Since #92 (deployed 0b9b8b2) the note
keeps accents: "téléphonne" → "téléphone".
NOT SAID: anything about endings. HOLD until #70.

CLAIM: "Reviews come back at growing intervals"
SOURCE: schedule.ts (interval doubles up to MAX_INTERVAL_DAYS). Verified.

CLAIM: "A word counts as learned when you've produced it on more than one day"
SOURCE: level/page.tsx text; isLearned = bestStage >= 3 in schedule.ts, and stage 2→3
waits a day (INTERVAL_MS[2] = 1 day). Verified. Exception: right answers in a
test-out or level-up challenge count as learned at once (store.ts), which the next
line covers.

CLAIM: "Test out … level-up challenge … certificate"
SOURCE: learn/level/page.tsx; learn/level/certificate/page.tsx. Verified.

CLAIM: "Your streak is never taken away, and your progress through each unit only goes
up"
SOURCE: standings.ts liveStreak/nextStreak; planner.ts unitProgress (best stages,
UnitMark). Verified. Reminder wording contradicts the streak half until #73. Not "every
progress bar": the level page's words/phrases/grammar bars can shrink until #91.

CLAIM: "No lives, no ads, nothing to pay"
SOURCE: no lives/hearts mechanic, no ad/analytics/payment code (grep of web/src,
web/package.json). Verified. Not "free forever".

CLAIM: "Reminders only if you turn them on: after two quiet days, then five, then
twelve, and then they stop"
SOURCE: reminders.ts REMINDER_DAYS = [2, 5, 12]; opt-in toggle in components/pwa.tsx.
Verified.

CLAIM: "Each invite code is a group with its own leaderboard, and there's no
messaging between learners"
SOURCE: schema.prisma InviteCode/GroupMember; no messaging model or route. Verified.

CLAIM: "No AI in the course … A few optional extra tools … do use AI"
SOURCE: the model is called (complete / streamCompletion) only from app/api/chat,
app/api/lessons/ask and lib/engine/activities.ts (exercises, translation grading,
flashcard explanations); app/api/steps/* makes no call. (lib/api.ts imports only the
error type from engine/model.) Verified.

CLAIM: "Not built yet: speaking your answers aloud, dictation, writing tasks, and
levels above A2"
SOURCE: open issues #54, #51, #56, #57. Verified. A statement of what's missing, not a
promise of dates.
```
