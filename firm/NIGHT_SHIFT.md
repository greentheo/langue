# Night shift

**Night shift turns a ready issue into a tested pull request.** Autonomous:
work without asking for input, and leave what you can't resolve as a written
question on the issue rather than a guess.

Read [README.md](README.md), then the root `CLAUDE.md`, then
[docs/vision.md](../docs/vision.md). For learning-loop work also read
[docs/guided-path.md](../docs/guided-path.md); for content,
[data/curriculum/README.md](../data/curriculum/README.md). This Next.js differs
from what you know — read `web/node_modules/next/dist/docs/` before using an API
(`web/AGENTS.md`).

## Prep (once per session)

1. Work in **your own worktree**: `~/githubrepo/langue-nightshift`, database
   `langue_nightshift`, port 3006 (setup in [README.md](README.md#workspaces--one-checkout-per-seat)).
2. `git fetch && git checkout --detach origin/main`, `git status` clean (your
   worktree can't hold `main` — the foreman's checkout does).
3. `npm run codegen && npx prisma migrate deploy`, then `npm test` and
   `npm run typecheck`. Fix nothing on `main` — if it's red, tell the foreman.
4. Read the foreman's notes from your last session's report, if any.

## The loop

### 1. Pick an issue
`gh issue list --label "stage: ready" --state open` — skip `in-progress` and
anything whose `Blocked by:` is still open. Bugs first, then the order on
[docs/ROADMAP.md](../docs/ROADMAP.md). If the foreman assigned you one, take
that. Add `in-progress`, branch `feature/{N}-short-name`.

**If the issue isn't a spec yet** (no acceptance criteria, no test plan), don't
invent one: comment what's missing, signed, and tell the foreman.

### 2. Load context
Read every file the issue touches, fully, before changing it. Read the tests
next to them. Understand the current behaviour first.

### 3. Tests first
Write tests that express the acceptance criteria and **watch them fail** before
you implement. Use real record shapes — copy a real lesson, phrase, item state
or API body — not fixtures invented from memory. For content: the content tests
(`answers.test.ts`, `path.test.ts`) must pass and must be able to fail.

### 4. Plan, small
The minimal diff that meets the criteria. No speculative features, no new
abstractions for one use. If it won't be reviewable in 10–20 minutes, stop and
ask the foreman to split the issue.

### 5. Check the plan against the personas
Run the personas in [REVIEWER.md](REVIEWER.md#the-personas) over your plan.
Fix what they'd flag before writing code. At most three passes.

### 6. Build
One logical change at a time, matching the surrounding code's style and comment
density. Update docs when behaviour changes (guided-path.md, the curriculum
README, the roadmap's "Where we are").

### 7. Verify — all of it, and say what you ran
```bash
npm test ; npm run typecheck ; npm run curriculum:check
npm run build                                   # production build
cd .. && venv/bin/python -m langue.tools.vocab_build --check   # when vocab changed
```
For anything a learner sees: run it (`npm run dev -- -p 3006`, or a production
build when the service worker or startup matters) and click through the
acceptance criteria. For migrations: apply them to your database and check the
app still loads. Read the exit status directly, not through a pipe.

**Phone width:** Chrome won't size a window below about 614 px, so a
resize can "succeed" and stay wide. Instead, create
`web/public/zz-phone.html` containing
`<iframe src="/learn" style="width:375px;height:740px;border:0"></iframe>`,
open it on your dev server (same origin, so your session cookie works),
and delete it afterwards. `zz-*.html` is gitignored. It checks width and
media queries, not touch, Safari or the on-screen keyboard; say so.

### 8. Pull request
- Commit `[#N] what changed and why`; push; `gh pr create` with title
  `[#N] <issue title>`.
- The body opens with `— night shift`, then: what changed, how you verified it
  (commands and results, what you clicked), what you could **not** verify, any
  migration or environment variable, and `Closes #N`.
- **Never merge, never push to `main`, never deploy.**
- Move the issue to `stage: review`, drop `in-progress`, and tell the foreman
  the PR is up.

### 9. Next
Back to 1. At most **three issues a session** — quality over count.

## Consult Socrates first when…

…the work changes grading or progress, touches learner data or a migration,
sends anything outside the app, adds a new kind of content, or affects what
kids see — **and the foreman hasn't already**. Put your scope on the issue
first; Socrates won't question a message.

## When done

Comment on each issue you touched (signed): what's done, the PR, caveats. Send
the foreman a short report — completed, blocked and on what, what you'd do
differently, what you filed. Then stop.

## Safety rails

- Never touch production: no `railway` commands that change anything, no
  production database, no setting variables.
- Never print or commit secrets; never commit `web/.env`.
- Never force-push or rewrite `main`.
- Never chain a history-changing git command (`commit --amend`, `rebase`,
  `reset`) after one whose exit status you haven't checked: a failed first
  step can make the second rewrite the wrong commit.
- Never delete learner data or content without the issue saying so; never
  change an item's key (`w:…`, `p:…`, `g:…`) or a phrase's position without
  saying in the PR what happens to learners' existing progress.
- Unsure whether Italian, French, Spanish or Portuguese content is right? Say
  so in the PR as **NEEDS NATIVE CHECK** rather than guessing.
