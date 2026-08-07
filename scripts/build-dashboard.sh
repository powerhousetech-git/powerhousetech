#!/usr/bin/env bash
# Build the Next.js medspa dashboard as a static export and publish under /dashboard
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/medspa-dashboard"

echo "→ Installing medspa-dashboard deps…"
cd "$APP"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "→ Building static export…"
NEXT_PUBLIC_DEMO_MODE="${NEXT_PUBLIC_DEMO_MODE:-true}" \
NEXT_PUBLIC_BOOKING_URL="${NEXT_PUBLIC_BOOKING_URL:-https://cal.com/powerhousetech}" \
npm run build

echo "→ Publishing dashboard assets to site root…"
rm -rf "$ROOT/dashboard" "$ROOT/_next"
mkdir -p "$ROOT/dashboard"

# Copy route HTML + assets (do NOT copy out/index.html — that would wipe marketing home)
cp -R "$APP/out/dashboard/." "$ROOT/dashboard/"
cp -R "$APP/out/_next" "$ROOT/_next"

# Optional 404 from Next export (namespaced)
if [ -f "$APP/out/404.html" ]; then
  cp "$APP/out/404.html" "$ROOT/dashboard/404.html"
fi

echo "→ Dashboard published at /dashboard/demo/"
ls -la "$ROOT/dashboard" | head -20
