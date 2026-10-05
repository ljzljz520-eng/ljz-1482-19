#!/bin/sh
set -e
echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy
echo "[entrypoint] starting server (seed is idempotent, runs at boot)..."
exec node dist/index.js
