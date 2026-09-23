#!/usr/bin/env bash
# Build the PowerhouseTech Outreach Command Center (Vite) and publish the static
# output under /command-center on the site root.
#
# Defaults to SAMPLE-DATA mode so the published page carries NO credentials.
# NEVER commit a build made with real VITE_GOOGLE_SERVICE_ACCOUNT_JSON /
# VITE_N8N_API_KEY into this public site — it would leak both keys. Build with
# real env vars only on a private, access-gated host (and behind an n8n proxy).
# See outreach-command-center/README.md.
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
VITE_USE_MOCK_DATA="${VITE_USE_MOCK_DATA:-true}" npm run build

echo "→ Published to $ROOT/command-center"
ls -la "$ROOT/command-center" | head -20
echo "→ Live route: /command-center/"
