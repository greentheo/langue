# Langue web — production image.
#
# The build context is the REPOSITORY ROOT, not web/. The web app compiles its
# vocabulary from data/flashcard_libraries at build time (scripts/build-vocab.mjs),
# so the Python CLI and the web app cannot drift apart. Building from web/ alone
# would fail with a clear error from that script.

# ---------------------------------------------------------------------------
# deps — install node_modules once, cached on the lockfile alone
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

COPY web/package.json web/package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — generate Prisma client + vocabulary, then build Next
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# The shared vocabulary lives one level up in the repo; build-vocab.mjs resolves
# it as ../data relative to the web root.
COPY data/ ../data/

ENV NEXT_TELEMETRY_DISABLED=1

# `next build` runs `prebuild` -> `codegen`, which compiles the vocabulary and
# generates the Prisma client. Prisma 7 needs no database connection to
# generate, but prisma.config.ts reads DATABASE_URL, so give it a placeholder
# that is never connected to.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run build

# ---------------------------------------------------------------------------
# migrator — a clean, self-consistent Prisma CLI for migrate-on-boot
# ---------------------------------------------------------------------------
# Cherry-picking node_modules/prisma and node_modules/@prisma out of the build
# stage does not work: the CLI pulls transitive deps (effect, @electric-sql,
# ...) that a selective COPY silently omits, and the container then dies at
# startup with MODULE_NOT_FOUND. Letting npm resolve the tree gives a complete
# one. It costs ~250MB, which buys deploys that need no manual migration step.
FROM node:22-alpine AS migrator
WORKDIR /cli
RUN npm init -y >/dev/null 2>&1 \
 && npm install --omit=dev --no-audit --no-fund prisma@7.9.1

# ---------------------------------------------------------------------------
# runner — standalone server + migration CLI
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next's standalone output bundles only the server code actually reached.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migrations run on container start, so the schema, its config, and a complete
# Prisma CLI have to be present in the runtime image. The CLI lives in its own
# directory rather than merging into ./node_modules, so it cannot shadow the
# @prisma/client that the standalone server bundle already resolves.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=migrator --chown=nextjs:nodejs /cli/node_modules ./migrate-cli/node_modules

# prisma.config.ts does `import { defineConfig } from "prisma/config"`, and that
# specifier is resolved from /app, not from wherever the CLI binary lives. Link
# the package into /app/node_modules so it resolves; Node then follows the link
# to its real path, so the CLI's own transitive requires resolve inside
# migrate-cli/node_modules rather than leaking into the app's tree.
RUN mkdir -p node_modules \
 && ln -sfn /app/migrate-cli/node_modules/prisma node_modules/prisma

COPY --chown=nextjs:nodejs web/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
