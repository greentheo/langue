# Langue Web

The browser version of Langue: AI language practice styled like an Apple IIe,
built to deploy on Railway so friends can use it too.

It shares vocabulary with the Python CLI in this repository — the same
`data/flashcard_libraries` JSON is compiled into the app at build time — but
runs entirely on TypeScript. There is no Python in the deployed image.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Server Components keep the API key and grading logic server-side by default |
| Language | TypeScript, strict | — |
| Styling | Tailwind CSS 4 + CSS custom properties | Phosphor palettes swap by changing variables, not classes |
| Database | PostgreSQL via Prisma 7 | Railway provides Postgres as a one-click service |
| Auth | Invite code + scrypt + server-side sessions | No third-party service, no native build step, revocable sessions |
| Model | Anthropic Claude (Haiku 4.5 default) | Called only from route handlers |

## Local development

Requires Node 22+ and a PostgreSQL database.

```bash
cd web
npm install
cp .env.example .env        # then fill in DATABASE_URL and ANTHROPIC_API_KEY

# A throwaway Postgres, if you don't already have one:
docker run -d --name langue-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=langue postgres:16-alpine

npm run db:deploy           # apply migrations
npm run invite              # print an invite code to register with
npm run dev                 # http://localhost:3000
```

Register with the code `npm run invite` printed. **The first account to
register becomes the admin**, and can mint further codes at `/learn/invites`.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (runs `codegen` first) |
| `npm run build` | Production build (runs `codegen` first) |
| `npm run codegen` | Compile vocabulary + generate the Prisma client |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests for the grading and parsing engine |
| `npm run invite -- --note "for Sam" --days 14` | Mint invite codes |
| `npm run db:deploy` | Apply migrations (production-safe) |
| `npm run db:migrate` | Create a new migration from schema changes |

## Deploying to Railway

The `Dockerfile` and `railway.json` live at the **repository root**, not in
`web/`. That is deliberate: the build needs `data/flashcard_libraries`, which
sits outside `web/`. Building with `web/` as the context fails fast with a
clear message from `scripts/build-vocab.mjs`.

1. **Create the project.** In Railway, "New Project" → "Deploy from GitHub
   repo" → pick this repository. Leave the root directory as `/`; Railway
   picks up `railway.json` and builds the root `Dockerfile`.

2. **Add Postgres.** In the same project, "New" → "Database" → "PostgreSQL".
   Railway injects `DATABASE_URL` into the web service automatically.

3. **Set the API key.** On the web service, Variables → New Variable:

   ```
   ANTHROPIC_API_KEY = sk-ant-...
   ```

   Get one at <https://console.anthropic.com/settings/keys>. Do not reuse the
   key that leaked in this repo's history (issue #1) — rotate it first.

4. **Deploy.** Migrations run automatically on container start via
   `docker-entrypoint.sh`, so there is no separate release step.

5. **Create the first account.**

   ```bash
   railway run npm run invite
   ```

   Register with that code. That account becomes the admin.

6. **Check health.** `https://<your-app>.up.railway.app/api/health` reports the
   database, the vocabulary catalog, and whether the API key is configured.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Injected by Railway's Postgres service |
| `ANTHROPIC_API_KEY` | for 4 of 5 activities | Flashcards work without it; everything else returns a clear 503 |
| `PORT` | no | Railway sets this; the Dockerfile defaults to 3000 |

## Architecture notes

### Vocabulary is compiled, not read at runtime

`scripts/build-vocab.mjs` turns `data/flashcard_libraries/**/*.json` into
`src/lib/vocab/generated.ts` during `prebuild`. Reading JSON off disk at request
time would mean async lookups everywhere and a runtime `ENOENT` the first time
the image was built without `data/`. Compiling makes vocabulary ordinary typed
code, and a missing catalog becomes a build failure instead of a production one.

To change vocabulary: edit `data/vocab_sources/<language>/<level>.psv` at the
repo root, run `python -m langue.tools.vocab_build`, then rebuild.

### Model failures are never disguised

The CLI's worst behaviour was converting every API error into a plausible canned
response, so a learner practising against a dead API saw fluent nonsense
(issue #4). Here `ModelUnavailableError` propagates to a 503 with the real
reason, and the UI renders it. Nothing in this codebase invents content on
failure.

Flashcards are graded locally by string comparison (`src/lib/engine/grade.ts`),
so a full round works with the Anthropic API completely down. The model is only
used to explain a wrong answer, and that call returns `null` rather than
throwing if it fails.

### Authorization lives in the data access layer

`src/proxy.ts` (Next 16's renamed middleware) only checks whether a session
cookie *exists*, purely to avoid rendering a page for a signed-out visitor. It
never validates anything. The real check is `verifySession()` in
`src/lib/auth/session.ts`, memoized per render with React `cache`, and every
protected page and route handler calls it.

API routes are excluded from the proxy matcher entirely — they answer with 401
JSON, and redirecting them would hand `fetch` an HTML login page and break
Railway's health probe.

### Points are written in exactly one place

`recordSession()` in `src/lib/progress.ts` is the only writer of points, word
stats, and streaks, and it runs in a transaction. The CLI awards points from
both the activity and the storage layer for the same answer, so totals drift
upward (issue #10).

## Known gaps

- **Spaced repetition is scaffolded, not implemented.** `WordStat` carries
  `dueAt`, `intervalDays`, and `ease` columns, but nothing schedules reviews
  yet — flashcards still sample uniformly. See issue #13.
- **Conversation scoring is participation-based.** There is no meaningful
  correctness signal for free conversation, so it awards a capped 5 points per
  exchange rather than pretending to grade.
- **Generated exercises are not cached.** Every fill-blank, translation, and
  reading round is a fresh API call.
