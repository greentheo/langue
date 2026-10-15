# Draft — the invite message

**For:** the owner and anyone with invite codes. **Replaces:** the text the
"Copy invite email" button builds (`web/src/lib/invite-email.ts`). Once
approved, #72 puts it in the app word for word. **Status:** draft, not sent.

Why it changes: today's email says *"learn a language with an AI tutor"*. The
course uses no AI, so it promises the wrong app.

Parts in `{braces}` are filled in by the app from the same inputs it uses
today. `{languages}` is the app's list, e.g. "Italian, Spanish, French and
Portuguese".

⚠ **Depends on #73:** "your streak is never taken away" is true, but the
reminder notifications still say the streak can "slip". Send as is, drop the
phrase, or decide #73 first. It's your call (#73 is with you).

---

## 1. The email (what the button copies)

**Subject:** Join me on Langue

> Hi!
>
> I've been learning with Langue, a small language app for family and
> friends. It teaches {languages}.
>
> What it's like:
> - Short steps, planned for about three minutes each. One button picks what's
>   next: new words, reviews that are due, and the things you keep missing.
> - You type the answers yourself. A missing accent or a small slip is
>   pointed out, with the right spelling.
> - Little role-plays from the first unit, like greeting a new friend or a
>   neighbour.
> - Beginner (A1) and Elementary (A2) are complete. If you already know some,
>   you can test out of the early units.
> - No ads, nothing to pay, and your streak is never taken away.
>
> Here's your invite:
> {link}
>
> {Your invite code is CODE (the link fills it in for you).} {It expires on
> DATE.} {It works for N more people.}
>
> Getting started:
> 1. Open the link.
> 2. Pick a name, your email and a password (at least 10 characters). Your
>    name is what your group sees on the leaderboard.
> 3. Choose your language and take your first step.
>
> On a phone, add Langue to your home screen and it works like an app.
>
> See you there,
> {inviterName}

The code line keeps today's three optional sentences unchanged (expiry and
uses only when they apply).

## 2. The short version (for WhatsApp, iMessage, a group chat)

The owner pastes this by hand. The app doesn't build it.

> I'm learning {language} on Langue, a small invite-only app for family and
> friends. Short daily steps, you type real answers (missing accents are
> pointed out), no ads. Here's an invite: {link}

---

## Sources, line by line

```
CLAIM: "a small language app for family and friends"
SOURCE: invite-only registration (web/prisma/schema.prisma InviteCode; register page
"Registration is invite-only"); vision "Who it's for". Verified.

CLAIM: "It teaches {languages}"
SOURCE: filled from availableLanguages() at send time, so always current. Verified.

CLAIM: "Short steps, planned for about three minutes each"
SOURCE: web/src/lib/path/planner.ts STEP_SECONDS = 180. A plan, not a measurement:
"planned for" is deliberate. Verified.

CLAIM: "One button picks what's next: new words, reviews that are due, and the things
you keep missing"
SOURCE: docs/guided-path.md (planner), web/src/lib/path/planner.ts. Verified.

CLAIM: "You type the answers yourself. A missing accent or a small slip is pointed
out, with the right spelling."
SOURCE: gradeTargetAnswer and typoOf in web/src/lib/engine/grade.ts; grade.test.ts
"a missing accent is close, with the accented form shown", "treats a small typo as
close, not wrong" (37/37 pass). Verified. "Pointed out", not "checked": a missing
accent is graded close and counts as right, and "checked" can be heard as "marked
wrong". CAVEAT #87: on a typo in an accented word, the note shows the spelling
without its accents; the "Answer:" line under it is right.
NOT SAID: "a wrong ending is marked wrong". On HOLD until #70.

CLAIM: "Little role-plays from the first unit, like greeting a new friend or a
neighbour"
SOURCE: unit-1 role-plays in data/curriculum/*/a1/dialogues.yaml: it "A new friend",
"Arriving at the hotel"; es "First day at school", "The lady next door"; fr "Salut !",
"Bonsoir, monsieur"; pt "A new classmate", "The lady upstairs". 16 role-plays per
language and level (curriculum:check). Verified. ("Checking into a hotel" was cut
because it's Italian only.)

CLAIM: "Beginner (A1) and Elementary (A2) are complete"
SOURCE: curriculum:check (15 lessons, 80–87 phrases, 16 role-plays per language and
level); level titles in level.yaml. Verified. (Implies nothing above A2; that's on
purpose.)

CLAIM: "you can test out of the early units"
SOURCE: web/src/app/learn/level/page.tsx "Test out of the units you know". Verified.

CLAIM: "No ads, nothing to pay"
SOURCE: no ad, analytics or payment code in web/src or web/package.json (grep);
vision "What we won't do". Not "free forever". Verified.

CLAIM: "your streak is never taken away"
SOURCE: web/src/lib/standings.ts liveStreak / nextStreak. Verified.
CAVEAT: the reminder notifications still say it can "slip". #73 is the owner's
decision, so the line is marked at the top of this draft.

CLAIM: "a password (at least 10 characters)"
SOURCE: RegisterSchema in web/src/lib/auth/actions.ts (.min(10)). Verified.

CLAIM: "Your name is what your group sees on the leaderboard"
SOURCE: Standing.displayName in web/src/lib/standings.ts. Verified.

CLAIM: "Choose your language and take your first step"
SOURCE: "What do you want to learn?" panel, web/src/app/learn/page.tsx (#41). Verified.

CLAIM: "add Langue to your home screen and it works like an app"
SOURCE: web/src/app/manifest.ts; install hint in web/src/components/pwa.tsx. Verified.

CLAIM (short version): "missing accents are pointed out", "no ads"
SOURCE: as above.
```

## What I'd measure

The invite page already shows uses per code. Once the owner sends codes with
this text (#72 shipped, or pasted by hand before then), record in
PIPELINE.md: codes sent, people joined, and people still practising after two
weeks (from `funnel.sql`, #75).
