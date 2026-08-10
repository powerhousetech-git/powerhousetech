#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-msratyvmnuvozuthgkmi}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Alternative (no CLI token): deploy via Supabase MCP in Cursor —" >&2
  echo "  apply_migration + deploy_edge_function (verify_jwt=false) for portal-session / admin-api." >&2
  echo "See docs/SECURITY_PORTAL.md." >&2
  echo "Or create a token at https://supabase.com/dashboard/account/tokens" >&2
  echo "Then: export SUPABASE_ACCESS_TOKEN=\"sbp_...\"" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FUNCTIONS=(
  tally-map-start
  tally-map-status
  user-credits
  book-build-start
  book-build-status
  software-download
  invoice-radar-proxy
  portal-session
  admin-api
)

echo "Deploying: ${FUNCTIONS[*]}"
npx -y supabase functions deploy "${FUNCTIONS[@]}" --project-ref "$PROJECT_REF"
echo "Done. Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
