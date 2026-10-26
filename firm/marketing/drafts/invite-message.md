# Draft — the invite message

**For:** the owner and anyone with invite codes. **Replaces:** the text the
"Copy invite email" button builds (`web/src/lib/invite-email.ts`). Once
approved, #72 puts it in the app word for word. **Status:** draft, not sent.

Why it changes: today's email says *"learn a language with an AI tutor"*. No AI
runs in the daily steps (only optional extra tools use it), so it promises
the wrong app.

Parts in `{braces}` are filled in by the app from the same inputs it uses
today. `{languages}` is the app's list, e.g. "Italian, Spanish, French and
Portuguese".

⚠ **#73, decided (gain framing); ships with #73:** "your streak is never taken
away" is true, but until #73 ships, today's reminders still say the streak can
"slip". Send now and accept the mismatch for a while, or wait for #73.

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
> - You type the answers yourself, and endings count: *cansados* for
>   *cansadas* is marked wrong, not waved through as a typo, and so are some
>   missing accents, like *parle* for *parlé*. Others, and small typos, are
>   pointed out with the right spelling.
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
> friends. Short daily steps, you type real answers, and a wrong ending is
> marked wrong (so are some missing accents). No ads. Here's an invite: {link}

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

CLAIM: "You type the answers yourself, and endings count: cansados for cansadas is
marked wrong, not waved through as a typo, and so are some missing accents, like parle
for parlé. Others, and small typos, are pointed out with the right spelling."
SOURCE: #102 (closes #70), deployed a81c9cb (2026-10-16). Probe on a81c9cb: pt "Estamos
cansados" for "cansadas" → incorrect, "Check the spelling of the ending: «cansadas»";
es "Comemos" for "Comimos" → incorrect, "That's another form — check the ending:
«Comimos»". All 13 #70 rows are incorrect both ways. Mid-word typos stay close
(fr "telefone" → "téléphone", it "ristorrante", pt "obirgado"). Verified.
ACCENTS: as in what-is-langue.md (#120, probe on 51b6ed8: fr "J'ai parle" → incorrect,
"That's another form — the accent is the grammar here"; "cafe" → close). This text goes
live with #128, after #120. "Some", not a rule: real words the course doesn't use stay
close (es "hable" for "hablé", fr "J'ai change" for "changé"; POSITIONING accent row),
so there's no reason clause (the first draft's "where the missing accent changes the
meaning" read as one; the reviewer, #130). "Others" is exact: every missing accent the
grader doesn't mark wrong is close.
LIMITS (POSITIONING), not contradicted: a typo that makes another real word
(attivo/cattivo) is forgiven until #106; endings.ts covers what's taught through A2,
which is the whole course today.
"Pointed out", not "checked": a close answer counts as right (schedule.ts
applyAnswer). The note quotes the answer with its accents (#92). "A small typo" sits
next to "endings count", so it reads as a typo elsewhere in the word, which is what
stays close.

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
CAVEAT: until #73 ships, the reminder notifications still say it can "slip". The
owner decided on gain framing with no threats (#73, comment 6219169112), so the
reminders and this line will agree once it ships.

CLAIM: "a password (at least 10 characters)"
SOURCE: RegisterSchema in web/src/lib/auth/actions.ts (.min(10)). Verified.

CLAIM: "Your name is what your group sees on the leaderboard"
SOURCE: Standing.displayName in web/src/lib/standings.ts. Verified.

CLAIM: "Choose your language and take your first step"
SOURCE: "What do you want to learn?" panel, web/src/app/learn/page.tsx (#41). Verified.

CLAIM: "add Langue to your home screen and it works like an app"
SOURCE: web/src/app/manifest.ts; install hint in web/src/components/pwa.tsx. Verified.

CLAIM (short version): "a wrong ending is marked wrong (so are some missing accents)",
"no ads"
SOURCE: as above (#102 probe on a81c9cb; #120 probe on 51b6ed8); no ad code (grep).
"Some", because #120 catches a missing accent only where the plain spelling is a word
the course uses. Not the bare "a wrong ending is marked wrong", even after #120: es
"Ayer hable" for "hablé" is still close and counts, so a Spanish learner would be
counted right against our word. (Until #120 this was "(a missing accent is pointed
out)", which reads as "and forgiven" once parle for parlé is marked wrong.)
```

## What I'd measure

The invite page already shows uses per code. Once the owner sends codes with
this text (#72 shipped, or pasted by hand before then), record in
PIPELINE.md: codes sent, people joined, and people still practising after two
weeks (from `funnel.sql`, #75).
