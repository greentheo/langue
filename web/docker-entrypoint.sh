#!/bin/sh
# Apply pending migrations, then hand off to the server.
#
# Running migrations here rather than as a separate Railway step keeps a deploy
# atomic: the new code never serves traffic against an old schema. `migrate
# deploy` only applies committed migrations and never generates or resets, so
# it is safe to run on every boot.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set. Attach a Postgres service to this app." >&2
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  # Not fatal: flashcards grade locally and still work. Everything that calls
  # the model will return a clear 503 rather than fabricating content.
  echo "WARNING: ANTHROPIC_API_KEY is not set — model-backed activities will fail." >&2
fi

echo "Applying database migrations..."
# The CLI is installed under ./migrate-cli so it cannot shadow the
# @prisma/client resolved by the standalone server bundle.
./migrate-cli/node_modules/.bin/prisma migrate deploy

echo "Starting Langue..."
exec "$@"
