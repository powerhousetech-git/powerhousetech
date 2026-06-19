#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-msratyvmnuvozuthgkmi}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens" >&2
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
)

echo "Deploying: ${FUNCTIONS[*]}"
npx -y supabase functions deploy "${FUNCTIONS[@]}" --project-ref "$PROJECT_REF"
echo "Done. Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
