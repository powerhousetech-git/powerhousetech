#!/usr/bin/env bash
# Build the PowerhouseTech Outreach Command Center (Vite) and publish the static
# output under /command-center on the MAIN site root.
#
# This is the REAL, admin-gated app: it is served on the main powerhousetech
# Netlify site at /command-center, gated by the site's Google admin sign-in, and
# talks only to the /api/* Netlify Functions (which hold the secrets server-side).
# No secret is ever bundled into the client, so this build is safe to commit.
#
# For a local sample preview without any backend, run instead:
#   cd outreach-command-center && VITE_USE_MOCK_DATA=true npm run dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/outreach-command-center"

echo "→ Installing outreach-command-center deps…"
cd "$APP"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "→ Building static site (base=/command-center/)…"
BASE_PATH="/command-center/" \
OUT_DIR="../command-center" \
npm run build

echo "→ Published to $ROOT/command-center"
ls -la "$ROOT/command-center" | head -20
echo "→ Live route: /command-center/ (admin sign-in required)"
