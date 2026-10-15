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
| About 500 words at A1 and 450–550 more at A2, depending on the language. | LIVE | Guided-path word items counted from `getCourse()`: A1 508–541, A2 438–536. Use "about"; don't quote one number for all four. |
| Levels above A2 aren't built yet. | LIVE (say it) | B1–C2 have overview pages only (docs/ROADMAP.md). B1 is #57. |
| Built on the CEFR levels (A1, A2…), each with a can-do list. | LIVE | `data/curriculum/*/a1/level.yaml` `can_do:`. **Not** "certified", "official", or "gets you to A2"; that needs exam evidence (#59). |
| Short steps, planned for about three minutes each. | LIVE | `web/src/lib/path/planner.ts` `STEP_SECONDS = 180`. It's a plan, not a measurement: say "planned for", not "takes". |
| One button picks your next step: something new, reviews that are due, things you keep missing. | LIVE | `docs/guided-path.md` (planner); `web/src/lib/path/planner.ts`. |
| Role-plays from the first unit, like greeting a new friend or a neighbour: you pick, then type, your reply. | LIVE | Unit-1 role-plays in `data/curriculum/*/a1/dialogues.yaml` (it "A new friend"; es "The lady next door"; fr "Salut !"; pt "The lady upstairs"…). Hotels etc. vary by language, so name situations only per language; `web/src/app/api/steps/answer/route.ts` `roleplayTurn` (picked or typed). **Not** "speak your reply"; that's #54. |
| You hear every word in your device's voice. | LIVE, with care | `web/src/lib/speech.ts` (speechSynthesis). Quality depends on the device; some have no voice for a language. Don't say "native audio". |

### How it grades

| Claim | Status | Source |
|---|---|---|
| You type real answers; words climb from recognising, to recalling, to typing, to using them in sentences and role-plays. | LIVE | `web/src/app/api/steps/answer/route.ts` (modes recognize, recall, build, type, cloze, reply, turn); `web/src/lib/path/schedule.ts` (rungs). |
| A missing accent is pointed out, with the right spelling. | LIVE | `gradeTargetAnswer` in `web/src/lib/engine/grade.ts`; tests "a missing accent is close, with the accented form shown" (`grade.test.ts`, 37/37 pass). **Careful:** a missing accent is graded *close* and **counts as right** (`schedule.ts` `applyAnswer`). Never say "a missing accent is marked wrong", and prefer "pointed out" to "checked", which can be heard that way. |
| A small slip in a long word is shown with the right spelling, accents included. | LIVE | `typoOf` in `grade.ts`; test "treats a small typo as close, not wrong". The note keeps accents since #92 (closes #87; deployed 2026-10-15, 0b9b8b2): probe `téléphonne` → *Close — the expected spelling is "téléphone"*. |
| A wrong ending is marked wrong. | **HOLD — #70** | True for Italian singular gender (stanca/stanco) and person (parlava/parlavo). **False** for Spanish/Portuguese plural gender (cansados/cansadas), French -é/-ée(s), and tenses that end in the same letter (comemos/comimos, parliamo/parlavamo): those are graded close and count as right. No test covers the rule. Say nothing about endings until #70 ships. |
| A miss is explained. | **HOLD** | You're shown the right answer and, for phrases, a literal translation or note (`why` in `steps/answer/route.ts`). "Explained" overstates it until #53. Say "you see the right answer". |
| Reviews come back at growing intervals. | LIVE | `web/src/lib/path/schedule.ts` (interval doubles, up to `MAX_INTERVAL_DAYS`). Don't add "so you never forget"; that's unmeasured. |
| "Learned" means you can produce it on more than one day. | LIVE | `web/src/app/learn/level/page.tsx` text; `isLearned` = `bestStage >= LEARNED_STAGE (3)` in `schedule.ts`. |
| Already know some? Test out of the units you know. Each unit ends with a level-up challenge; each level has a certificate. | LIVE | `web/src/app/learn/level/page.tsx` ("Test out", "Level-up challenge"), `web/src/app/learn/level/certificate/page.tsx`. The certificate is Langue's own, not an exam result. |

### How it treats you

| Claim | Status | Source |
|---|---|---|
| Your streak is never taken away. It counts the days you've practised; a break doesn't reset it. | LIVE | `web/src/lib/standings.ts` `liveStreak` (unchanged), `nextStreak` (+1 after any gap). But the reminder notifications still say it can "slip" (#73). |
| Your progress through each unit, and the level as a whole, only goes up. | LIVE | `web/src/lib/path/planner.ts` `unitProgress` counts best stages and keeps `UnitMark.bestPercent`; the level percent is the mean of the unit percents (`web/src/lib/path/levels.ts` l.68). |
| Every progress bar only goes up. | **HOLD — #91** | The level page's Words, Phrases, Grammar and Speaking bars divide by the level's *current* item count (`levels.ts` l.40–47), so adding content shrinks them, under the page's own "Bars never go backwards". #91 (in progress) replaces them with counts. The 2026-10-15 ship (#89, #92) added no items (per-level counts identical to 4f00646), and the it/es/pt content (#83, #86, #88) ships with #91. Say "each unit", not "every bar", until #91 is live. |
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
| The course doesn't use AI: lessons, steps, role-plays, grading, reviews and reminders are fixed content and plain code. | LIVE | Only `app/api/chat`, `app/api/lessons/ask` and `lib/engine/activities.ts` (used by `app/api/exercises`, `exercises/grade`, `flashcards/answer`) **call** the model (`complete` / `streamCompletion`); `app/api/steps/*` makes no call. Say "call", not "import": `lib/api.ts` imports the model module's error type, so everything imports it transitively. |
| Some optional extra tools do use AI: the Conversation partner, the Reading, Translation and Fill-in-the-blank exercises, "ask about this lesson", and explanations of a missed flashcard. | LIVE (say it) | As above. Model: `claude-haiku-4-5`, Anthropic's small model (`web/src/lib/engine/model.ts`, default tier `fast`). |
| What you type into those tools is sent to Anthropic. | LIVE (say it) | `app/api/chat/route.ts` posts the transcript to the model. #63's privacy page will say it too. |
| AI-written exercises aren't checked the way the course is. | LIVE (say it) | The content checks cover `data/curriculum` and vocabulary only. |
| The AI tools are labelled as AI in the app. | **CUT for now** | They aren't: "Talk with a tutor", "graded on meaning" (`web/src/app/learn/page.tsx`). Noted on #74. |
| A parent can turn the AI tools off for a child. | **CUT for now** | No such switch. Decision on #74. |

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
- Names of other apps. The vision's contrast ("built to make you *feel*
  fluent") is ours to make about the design, not about a named competitor.
