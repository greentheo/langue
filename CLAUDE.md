# Langue — guide for Claude

Langue is a language-learning web app (Next.js in `web/`, deployed to Railway)
for a family-and-friends group, plus an older Python CLI (`langue/`).

## Read first

- **[docs/vision.md](docs/vision.md)** — what Langue is for and how it differs:
  read, write and speak correctly at real levels; accuracy first; mistakes
  made visible; no dark patterns; algorithms and content before AI; built to
  grow beyond Romance languages. Check product decisions against it.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — what's live, known gaps, and the
  ordered backlog (GitHub issues #48 onward).
- [docs/guided-path.md](docs/guided-path.md) — the learning loop (items,
  stages, steps, units, challenges).
- [data/curriculum/README.md](data/curriculum/README.md) — how lessons,
  phrases, role-plays and vocabulary examples are written.
- [web/AGENTS.md](web/AGENTS.md) — this Next.js version differs from training
  data; read its docs in `web/node_modules/next/dist/docs/` before using an API.

## Working agreements

- **The owner spends ~10–20 minutes a day on the app.** Take the next issue
  from the roadmap, build it on a branch, open a PR with a short summary and
  how it was checked. Keep PRs reviewable in that time.
- **Never merge to `main` without the owner's go-ahead** ("ship it"): `main`
  auto-deploys to production, where the family is learning.
- **No AI in the learning loop** unless an issue says so; when AI is used,
  it's optional, capped, and the cheapest model (`claude-haiku-4-5`).
- **Content is data and must stay tested.** After content changes run the
  curriculum check, the vocab check and the web tests (they verify every
  listed answer grades correct, nothing is taught twice, every card renders).
- **Progress never goes backwards and streaks are never lost** — keep it so.
- Never print or commit secrets (`web/.env` is local and gitignored; set
  production variables with `railway variables --set-from-stdin`).

## Commands (from `web/`)

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.1/bin:$PATH"
docker start langue-pg                 # local Postgres on :5433
npm run codegen                        # vocab + curriculum + prisma client
npm run dev                            # local app
npm test && npm run typecheck          # tests (node --test) and types
npm run curriculum:check               # validate data/curriculum
cd .. && venv/bin/python -m langue.tools.vocab_build --check   # vocab sources → JSON
```

Production: `railway status`, `railway logs`; health at `/api/health`.
Migrations run on container start; startup also records progress marks and
starts the hourly streak-reminder check (`web/src/instrumentation.ts`).
