#!/usr/bin/env bash
# Build the PowerhouseTech Outreach Analytics dashboard (Vite) and publish the
# static output under /outreach-dashboard on the site root.
#
# By default it builds in SAMPLE-DATA mode so the published page is viewable
# without embedding any Google credentials into the static bundle (never commit
# a real service-account key into this public build — see outreach-analytics/README.md).
#
# To build against real data on a PRIVATE host, export the env vars first:
#   VITE_USE_MOCK_DATA=false \
#   VITE_SPREADSHEET_ID=... \
#   VITE_GOOGLE_SERVICE_ACCOUNT_JSON=... \
#   scripts/build-outreach-analytics.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/outreach-analytics"

echo "→ Installing outreach-analytics deps…"
cd "$APP"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "→ Building static site (base=/outreach-dashboard/)…"
VITE_USE_MOCK_DATA="${VITE_USE_MOCK_DATA:-true}" npm run build

echo "→ Published to $ROOT/outreach-dashboard"
ls -la "$ROOT/outreach-dashboard" | head -20
echo "→ Live route: /outreach-dashboard/"
