# Draft — "What is Langue" (one page, and the new front page)

**For:** anyone deciding whether to join, and parents. **Doubles as** the
front page (`/`): #72 replaces the tagline and the Catalog and Activities
panels with this text, and keeps the banner, green screen and Sign in /
Redeem invite. **Status:** live in the app since 8f7d6e1 (#128, 2026-10-26).

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
> The levels are built on the CEFR, the European scale from A1 to C2.
> Higher levels aren't built yet.
>
> **How it works**
> - **Short steps.** Each step is planned for about three minutes. One
>   button picks the next one: something new, reviews that are due, and the
>   things you keep missing.
> - **You produce the language.** A new word climbs from recognising it, to
>   recalling it, to typing it, to using it in a sentence and in a role-play.
> - **Endings count.** A slip that changes a word's ending (*cansados* for
>   *cansadas*, *comemos* for *comimos*) is marked wrong, not forgiven as a
>   typo, because the ending is the grammar. So are some missing accents,
>   like *parle* for *parlé*. Others (*cafe* for *café*), and small typos in
>   the middle of a word, are pointed out with the right spelling and still
>   count.
> - **Reviews come back** at growing intervals. A word counts as learned
>   when you've produced it on more than one day.
> - **Already know some?** Test out of the units you know. Each unit ends
>   with a level-up challenge, and each level with a certificate.
>
> **Kind by design**
> - Your streak is never taken away, and progress bars only go up.
> - No lives, no ads, nothing to pay.
> - Reminders only if you turn them on: after two quiet days, then five, then
>   twelve, and then they stop.
> - Private groups. Each invite code is a group with its own leaderboard,
>   and there's no messaging between learners.
>
> **No AI in the daily steps.** The steps, with their role-plays, grading
> and reviews, are fixed content and plain code, the same for everyone. A
> few optional extra tools do use AI: the "Ask about this lesson" box at the
> end of each lesson page, a conversation partner, some extra exercises (one
> is graded by AI), and the explanation you get when you miss a flashcard.
>
> **Not built yet:** speaking your answers aloud, dictation, writing tasks,
> and levels above A2.
>
> Langue is invite-only.
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

CLAIM: "built on the CEFR, the European scale from A1 to C2"
SOURCE: level.yaml can_do lists. NOT certified. Wording per firm/MARKETING.md. Verified.
CUT: "each one comes with a list of what you'll be able to do". The lists include
things the course doesn't practise yet: listening to recordings, speaking aloud,
connected writing (e.g. fr A1 "understand slow, clear speech…", "write a short message
or postcard"). HOLD until #100.

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

CLAIM: "A slip that changes a word's ending (cansados for cansadas, comemos for
comimos) is marked wrong, not forgiven as a typo … So are some missing accents, like
parle for parlé. Others (cafe for café), and small typos in the middle of a word, are
pointed out with the right spelling and still count."
SOURCE: #102 (closes #70), deployed a81c9cb (2026-10-16). Probe on a81c9cb: pt "Estamos
cansados" for "cansadas" → incorrect, "Check the spelling of the ending: «cansadas»";
es "Comemos" for "Comimos" → incorrect, "That's another form — check the ending:
«Comimos»". All 13 #70 rows are incorrect both ways. Mid-word typos stay close
(fr "telefone" → "téléphone", it "ristorrante", pt "obirgado"). Verified.
ACCENTS: #120 (closes #114), PR head 51b6ed8; this line goes live with #128, after
#120. Probe with gradeTargetAnswer on 51b6ed8: fr "J'ai parle" → incorrect, "That's
another form — the accent is the grammar here: «J'ai parlé»" (test "an accent in the
ending is the grammar"); fr "cafe" → close, "Watch the accents" (test "a missing accent
that makes no word is still only close").
WHY "SOME", NOT A RULE: #120 marks a missing accent wrong only where the plain spelling
is a word the course uses, or one of its short-word pairs. Real words the course doesn't
use stay close: es "hable" for "hablé", "compre"/"compré", "llegue"/"llegué"; fr "J'ai
change" for "changé", "J'ai casse" for "cassé" (92 of the 233 uncaught French words end
in consonant + é, mostly participles whose plain spelling is a present form; the
reviewer on #130); it "passo"/"passò"; and a bare capital ("E stanco", "A demain"). So
the line says "some", with parle/parlé as an example, and gives no reason clause: the
first draft's "where the missing accent changes the meaning" read as a rule, and J'ai
change also changes the meaning (the reviewer, #130). "Others … still count" is exact:
every missing accent the grader doesn't mark wrong is close.
LIMITS (POSITIONING), not contradicted: a typo that makes another real word
(attivo/cattivo) is forgiven until #106; endings.ts covers what's taught through A2,
which is the whole course today. "Still counts": schedule.ts applyAnswer ("A close
answer … counts as right").

CLAIM: "Reviews come back at growing intervals"
SOURCE: schedule.ts (interval doubles up to MAX_INTERVAL_DAYS). Verified.

CLAIM: "A word counts as learned when you've produced it on more than one day"
SOURCE: level/page.tsx text; isLearned = bestStage >= 3 in schedule.ts, and stage 2→3
waits a day (INTERVAL_MS[2] = 1 day). Verified. Exception: right answers in a
test-out or level-up challenge count as learned at once (store.ts), which the next
line covers.

CLAIM: "Test out … level-up challenge … certificate"
SOURCE: learn/level/page.tsx; learn/level/certificate/page.tsx. Verified. The certificate
is mentioned as a feature only, never as evidence of ability: until #100 it says "has
completed" and ticks every can-do, practised or not (POSITIONING: HOLD).

CLAIM: "Your streak is never taken away, and progress bars only go up"
SOURCE: standings.ts liveStreak/nextStreak; planner.ts unitProgress (best stages,
UnitMark); since #96 (deployed a81c9cb) the level page's word/phrase/grammar rows are
counts, so every drawn bar is protected. Verified. Reminder wording contradicts the
streak half until #73. NOT SAID: "what you've learned never drops" (HOLD #93).

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

CLAIM: "No AI in the daily steps … fixed content and plain code, the same for everyone
… A few optional extra tools do use AI: the 'Ask about this lesson' box …"
CORRECTED 2026-10-20 (PR #125): it said "No AI while you learn. Lessons, steps …", but
every lesson page ends with the AI box (app/learn/lessons/[id]/page.tsx l.98–103).
SOURCE: the model is called (complete / streamCompletion) only from app/api/chat,
app/api/lessons/ask and lib/engine/activities.ts (exercises, translation grading,
flashcard explanations); app/api/steps/* makes no call. (lib/api.ts imports only the
error type from engine/model.) Verified.
NOT IMPLIED: who wrote the course. Per #97, every A1/A2 line was written by AI writer
agents and reviewed by AI, with no native check yet. The owner decided (2026-10-16,
#97) on no FAQ line about it, so the copy says what *runs* ("in the daily steps"), never
"no AI in the course", which reads as "people wrote it".

CLAIM: "Langue is invite-only."
SOURCE: registration needs an invite code (schema.prisma InviteCode; register page
"Registration is invite-only"). Verified. Was "invite-only, for family and friends":
true today, not once campaign 002 opens 25 places to the owner's LinkedIn network
(#124, the owner's "Yes, capped"). Cut now so the front page needn't change again then.

CLAIM: "Not built yet: speaking your answers aloud, dictation, writing tasks, and
levels above A2"
SOURCE: open issues #54, #51, #56, #57. Verified. A statement of what's missing, not a
promise of dates.
```
