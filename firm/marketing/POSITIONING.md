# Positioning — what we say, and where it's true

Every claim marketing makes, in the words we use, with the file, test or
number that makes it true. A claim that isn't here doesn't go in a draft.
Checked against `main` @ 4f00646 on 2026-10-15. Re-check a claim when the
code under its source changes.

Status: **LIVE** = say it. **HOLD** = true in part or soon; don't say it yet.
**CUT** = never say it.

## The promise

The vision's promise is *read, write and speak a language correctly, at real
levels, a few minutes a day, without tricks.* Today Langue does the
**writing-it-down** part well. Speaking aloud, dictation, writing tasks and
readers aren't built yet (#51, #54, #56, #58). So the public line is narrower
than the vision:

> **Langue is a language course in short daily steps, where you type the
> answers yourself — for family and friends, invite-only.**

## Claims

### What it teaches

| Claim, in our words | Status | Source |
|---|---|---|
| Italian, Spanish, French and Brazilian Portuguese. | LIVE | `data/curriculum/{italian,spanish,french,portuguese}`; Brazilian: `data/curriculum/README.md` l.27, `web/src/lib/languages.ts` (pt-BR). The app labels it just "Portuguese", so say "Brazilian" in our own copy. |
| Beginner (A1) and Elementary (A2) are complete in all four languages. | LIVE | `npm run curriculum:check`: every language × A1/A2 has 15 lessons, 80–87 phrases, 16 role-plays. Each level has 10 units (`level.yaml` `units:`). |
| About 500 words at A1 and 450–550 more at A2, depending on the language; about a thousand in all. | LIVE | Guided-path word items from `getCourse()` on a81c9cb (2026-10-16): A1 508–541, A2 458–536; A1+A2 it 975, es 1009, fr 1077, pt 1031. Use "about"; don't quote one number for all four. Re-count after any content ship. |
| Levels above A2 aren't built yet. | LIVE (say it) | B1–C2 have overview pages only (docs/ROADMAP.md). B1 is #57. |
| Built on the CEFR levels (A1, A2…). | LIVE | `data/curriculum/*/a1/level.yaml` `can_do:`. **Not** "certified", "official", or "gets you to A2"; that needs exam evidence (#59). |
| What a learner can do at a level: the can-do list, or the certificate as proof. | **HOLD — #100** | Today the certificate (`web/src/app/learn/level/certificate/page.tsx` l.63–90) says *"has completed"* and puts a ✓ beside **every** can-do in `level.yaml`, including ones the course doesn't practise yet: listening to recordings, speaking aloud, connected writing (fr A1: "understand slow, clear speech…", "write a short message or postcard"). Don't quote the list or the certificate as evidence of ability; "built on the CEFR" stays the wording. #100 (v2) drops the ticks: the certificate will read "finished Langue's A1 course · not an exam result", list "The course practised:", and say how the units were finished. After it ships, those exact words are quotable; the list still isn't proof of ability. |
| Short steps, planned for about three minutes each. | LIVE | `web/src/lib/path/planner.ts` `STEP_SECONDS = 180`. It's a plan, not a measurement: say "planned for", not "takes". |
| One button picks your next step: something new, reviews that are due, things you keep missing. | LIVE | `docs/guided-path.md` (planner); `web/src/lib/path/planner.ts`. |
| Role-plays from the first unit, like greeting a new friend or a neighbour: you pick, then type, your reply. | LIVE | Unit-1 role-plays in `data/curriculum/*/a1/dialogues.yaml` (it "A new friend"; es "The lady next door"; fr "Salut !"; pt "The lady upstairs"…). Hotels etc. vary by language, so name situations only per language; `web/src/app/api/steps/answer/route.ts` `roleplayTurn` (picked or typed). **Not** "speak your reply"; that's #54. |
| You hear every word in your device's voice. | LIVE, with care | `web/src/lib/speech.ts` (speechSynthesis). Quality depends on the device; some have no voice for a language. Don't say "native audio". |

### How it grades

| Claim | Status | Source |
|---|---|---|
| You type real answers; words climb from recognising, to recalling, to typing, to using them in sentences and role-plays. | LIVE | `web/src/app/api/steps/answer/route.ts` (modes recognize, recall, build, type, cloze, reply, turn); `web/src/lib/path/schedule.ts` (rungs). |
| A missing accent is pointed out, with the right spelling. | LIVE | `gradeTargetAnswer` in `web/src/lib/engine/grade.ts`; tests "a missing accent is close, with the accented form shown" (`grade.test.ts`). **Careful:** a missing accent is graded *close* and **counts as right** (`schedule.ts` `applyAnswer`). That holds even when the accent *is* the grammar: es *Ayer hablo* for *habló* → close, "Watch the accents" (probe on a81c9cb). Never say "a missing accent is marked wrong", and prefer "pointed out" to "checked". |
| A small typo in the middle of a word is shown with the right spelling, accents included, and counts. | LIVE | `typoOf` in `grade.ts` (stem typos stay close since #102); the note quotes the answer as written since #92. Probe on a81c9cb: fr *telefone* → *Close — the expected spelling is "téléphone"*; it *ristorrante*, pt *obirgado*, es *restuarante* → close. **Not** "any small typo": since #102 a slip in a word's last three letters is marked wrong (*téléphonne* → "Check the spelling of the ending: «téléphone»"). #102 measured forgiven one-letter slips falling from ~88% to ~62%. |
| Through A2, a slip that changes a word's ending is marked wrong, not forgiven as a typo. Short form **until #114**: "a wrong ending is marked wrong (a missing accent is pointed out)". After #114: "a wrong ending is marked wrong". | LIVE | #102 (closes #70), deployed a81c9cb (2026-10-16; GitHub deployment success, CI green); `web/src/lib/engine/endings.ts`, `endings.test.ts`, the #70 rows in `grade.test.ts`. My probe on a81c9cb: all 13 #70 rows are incorrect in both directions, with "That's another form — check the ending: «…»" or "Check the spelling of the ending: «…»". **Limits, never contradicted:** (1) grammar carried only by an accent is pointed out and counts, not marked wrong. That includes **French's commonest A1–A2 ending, the past participle's -é** (*J'ai parle* for *parlé* → close), es -ó (*hablo* / *habló*) and pt -ô (*pode* / *pôde*); probe on ef01562. So **any line saying endings are marked wrong must carry the accent carve-out until #114**. (2026-10-19: I'd judged the bare short form safe because it "says nothing about accents". The reviewer showed it isn't, for French. #114 is the grader fix.) (2) a slip that makes a different real word (*attivo* for *cattivo*) is still forgiven until #106; (3) "through A2": `endings.ts` covers the endings taught through A2. Copy may drop "through A2" while the course stops at A2. When B1 ships (#57), check `endings.ts` covers it before the short form stays. |
| A miss is explained. | **HOLD** | You're shown the right answer and, for phrases, a literal translation or note (`why` in `steps/answer/route.ts`). "Explained" overstates it until #53. Say "you see the right answer". |
| Reviews come back at growing intervals. | LIVE | `web/src/lib/path/schedule.ts` (interval doubles, up to `MAX_INTERVAL_DAYS`). Don't add "so you never forget"; that's unmeasured. |
| "Learned" means you can produce it on more than one day. | LIVE | `web/src/app/learn/level/page.tsx` text; `isLearned` = `bestStage >= LEARNED_STAGE (3)` in `schedule.ts`. |
| Already know some? Test out of the units you know. Each unit ends with a level-up challenge; each level has a certificate. | LIVE | `web/src/app/learn/level/page.tsx` ("Test out", "Level-up challenge"), `web/src/app/learn/level/certificate/page.tsx`. The certificate is Langue's own, not an exam result. Name it as a feature only; see the #100 HOLD above. |

### How it treats you

| Claim | Status | Source |
|---|---|---|
| Your streak is never taken away. It counts the days you've practised; a break doesn't reset it. | LIVE | `web/src/lib/standings.ts` `liveStreak` (unchanged), `nextStreak` (+1 after any gap). Until #73 ships, the reminder notifications still say it can "slip". The owner decided on gain framing, no threats (#73). |
| Progress bars only go up: each unit's bar and the level's. | LIVE | `web/src/lib/path/planner.ts` `unitProgress` counts best stages and keeps `UnitMark.bestPercent`; the level percent is the mean of the unit percents (`web/src/lib/path/levels.ts`). Since #96 (closes #91, deployed a81c9cb) the level page's Words, Phrases, Grammar and Speaking rows are counts ("learned · not met yet", "on the way"), not bars, so no drawn bar can shrink when content is added. The page says "What you've learned only goes up … bars never go backwards." |
| The *counts* of what you've learned never drop. | **HOLD — #93** | A count drops if an item's key changes (a respelt or removed word). #93 (open) makes renames carry progress and removals need acknowledging. Say "bars", not "everything you've learned", until #93 ships. |
| Reminders only if you turn them on: after two quiet days, then five and twelve, then they stop. Early evening only. | LIVE | `web/src/lib/reminders.ts` `REMINDER_DAYS = [2, 5, 12]`, 5–8pm local; opt-in "Turn on reminders" in `web/src/components/pwa.tsx`. iPhone: only when Langue is on the home screen. |
| No lives or hearts; nothing stops you learning. | LIVE | No such mechanic in `web/src` (grep for lives/hearts finds only comments). |
| Private groups: you join with an invite code, and each code is a group with its own leaderboard. | LIVE | `web/prisma/schema.prisma` `InviteCode`, `GroupMember`; `web/src/lib/leaderboard.ts`. |
| Your group sees your name, points, streak and level badges. Nothing else. | LIVE | `Standing` in `web/src/lib/standings.ts` (displayName, weekPoints, totalPoints, streak, badges). |
| There's no way to message other learners. | LIVE | No messaging model in `schema.prisma`; no messaging route in `web/src/app/api`. |
| Several learners can share one phone or tablet: tap the name to switch. | LIVE | `web/src/components/device-accounts-note.tsx`. |
| Works like an app: add it to your home screen. | LIVE | `web/src/app/manifest.ts`, install hint in `web/src/components/pwa.tsx`. iPhone: the installed app keeps its own login (docs/ROADMAP.md). |
| No ads, and nothing to pay. | LIVE | No ad, analytics or payment code in `web/src` or `web/package.json` (grep); vision "What we won't do". **Not "free forever"**: the owner pays for hosting and AI. |
| We don't sell data. | LIVE (vision words only) | docs/vision.md "What we won't do". Further privacy wording waits for the privacy page (#63). |
| Sign-up asks for a name, an email address and a password. Langue sends no email. | LIVE | `RegisterSchema` in `web/src/lib/auth/actions.ts`; no mail library in `web/package.json` or `web/src`. |
| Your email is only used to sign in. | **HOLD — #63** | True in code today (the address appears only in `auth-forms.tsx` and the `User` row), but it's a promise about how data is used. That's the privacy page's job, so wait for #63. |

### AI

| Claim | Status | Source |
|---|---|---|
| No AI runs in the daily steps: the steps (new words, reviews, role-plays, challenges), their grading, and reminders are fixed content and plain code. Each lesson's text is fixed too, **but every lesson page ends with an optional "Ask about this lesson" box that uses AI** (row below). Say "no AI in the daily steps" or "your answers in the daily steps are graded by plain code, not AI": keep "in the daily steps", because the optional Translation exercise is graded by the model (`api/exercises/grade/route.ts` l.11–12). **Not** "no AI while you learn" or "in the lessons" (a lesson page has the AI box), and not "no AI in the course" (#97). | LIVE | Only `app/api/chat`, `app/api/lessons/ask` and `lib/engine/activities.ts` (used by `app/api/exercises`, `exercises/grade`, `flashcards/answer`) **call** the model (`complete` / `streamCompletion`); `app/api/steps/*` makes no call, and no step component reaches an AI route (`AskTutor` is only on `app/learn/lessons/[id]/page.tsx` l.98–103). Corrected 2026-10-20 (reviewer, PR #125): this row used to list "lessons" as no-AI. Say "call", not "import": `lib/api.ts` imports the model module's error type, so everything imports it transitively. |
| Some optional extra tools do use AI: the Conversation partner, the Reading, Translation and Fill-in-the-blank exercises, "ask about this lesson", and explanations of a missed flashcard. | LIVE (say it) | As above. Model: `claude-haiku-4-5`, Anthropic's small model (`web/src/lib/engine/model.ts`, default tier `fast`). |
| What you type into those tools is sent to Anthropic. | LIVE (say it) | `app/api/chat/route.ts` posts the transcript to the model. #63's privacy page will say it too. |
| AI-written exercises aren't checked the way the course is. | LIVE (say it) | The content checks cover `data/curriculum` and vocabulary only. |
| The AI tools are labelled as AI in the app. | **CUT** | They aren't ("Talk with a tutor", "graded on meaning", `web/src/app/learn/page.tsx`), and the owner decided on no AI labels in menus (#74). Once #74 ships, the two conversational screens (the conversation partner and "ask the tutor") open with one line, *"Your practice partner is an AI."* AI-written drills, readings, translation grading and flashcard explanations carry none. So the FAQ's "Does Langue use AI?" answer is where we list every AI tool: keep it. |
| A parent can turn the AI tools off for a child. | **HOLD — #74** | Owner's decision (#74, 2026-10-16): AI stays **on by default for every account, children's included**. A per-learner switch in Settings ("AI features") turns all AI off; with it off, the AI features are simply gone, not replaced. An admin can turn it off and **lock** it. The AI prompts get child-safety instructions. None of that exists until #74 ships; the FAQ says "no parental switch yet". |

## Waiting on a ship

Claims and lines that change the day a PR is **deployed**, not merged.
Check the deploy, re-run the probe, then make every listed edit in one
commit.

- **#100 (certificate):** see the HOLD row. Once deployed, its exact words
  ("finished Langue's A1 course · not an exam result") can be quoted.
- **#93 (keys stay put):** lifts the "counts never drop" HOLD.
- **#106 (real-word typos):** removes limit (2) from the endings claim.
- **#114 (accent-only endings marked wrong):** removes limit (1). The plain short
  form "a wrong ending is marked wrong" then holds. Drop "(a missing accent is
  pointed out)" from the invite's chat version and campaign 001's message, and
  re-word the FAQ's and what's-new's accent carve-outs to match the shipped
  behaviour.
- **#107 (ending note wording):** the misspelt-ending note becomes "Check the
  ending: «…»". Update the FAQ's "check the ending" answer, which quotes
  "Check the spelling of the ending", and the what-is/invite/FAQ sources.
- **#73 (gain-framed reminders):** remove the ⚠ #73 notes from the invite and
  what's-new drafts, drop the FAQ's "(Today's reminder wording…)" aside, and
  check the new reminder texts promise only what the learner's next unit
  teaches (as #73's design says).
- **#74 (per-learner AI switch, child-safety instructions):** lift the HOLD
  row, check the deployed Settings page wording, then replace the FAQ's
  "Will my child talk to an AI?" answer with (draft):
  > Not in the daily steps. Two optional tools let anyone type to an AI: the
  > "Ask about this lesson" box at the end of each lesson page, and the
  > conversation partner. Some extra exercises and the flashcard explanations
  > use it too. They're on by default for every account. You can turn all AI off for your child in Settings → AI
  > features, or ask the person who runs Langue to turn it off and lock it.
  > The conversation screens tell your child their practice partner is an AI.
  > What's typed into them is sent to Anthropic.
  Also add the Settings switch to the general "Does Langue use AI?" answer.
- **#105 (typos in the last three letters forgiven again):** widen the typo
  row back from "the middle of a word", and the FAQ's "close" answer with it.
- **Done 2026-10-16:** #96 (bars) and #102 (endings), deployed a81c9cb. The
  switch-over was made in one commit: endings LIVE; typo rule narrowed to the
  middle of a word; bars HOLD lifted; what-is, FAQ and what's-new updated.

## Never say

- "AI tutor", "AI language practice" or "AI-powered" for Langue as a whole. It's
  what the app said until now (#72), and it's backwards.
- "Certified", "official levels", "pass the DELF/DELE/CILS…", "fluent in N
  weeks", "A1 in ten weeks". The units are *designed* for about a week each
  (`data/curriculum/README.md`); nobody has measured it.
- "Free forever", "always free".
- "Native audio", "native speakers wrote it", "written by teachers". We can't
  show who wrote the content; the device voice isn't recorded audio.
- Numbers of learners, ratings, testimonials: none yet. See PIPELINE.md.
- Anything about speaking aloud, dictation, writing tasks, readers, exam
  practice or B1 as if it exists. Say "not built yet" if it comes up.
- Anything that says or implies people wrote the course. Every A1/A2 line
  was written by AI writer agents and reviewed by AI, with no native check
  yet (#97). The owner decided (2026-10-16) on no FAQ line about it, so we
  don't volunteer it, and we don't imply the opposite either: no "written
  by teachers", "native speakers", "hand-written", or "no AI in the course".
- Names of other apps. The vision's contrast ("built to make you *feel*
  fluent") is ours to make about the design, not about a named competitor.
