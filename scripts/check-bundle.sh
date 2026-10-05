#!/usr/bin/env bash
# Build-time check for F02: the service role key must never reach the browser bundle.
set -euo pipefail
dir="${1:-.next/static}"
[ -d "$dir" ] || { echo "no build output at $dir, run next build first"; exit 2; }
if grep -rIl -E "SERVICE_ROLE|service_role" "$dir"; then
  echo "FAIL: service role key name found in the client bundle"; exit 1
fi
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && grep -rIl -F -- "$SUPABASE_SERVICE_ROLE_KEY" "$dir"; then
  echo "FAIL: service role key value found in the client bundle"; exit 1
fi
echo "ok: no service role key in $dir"
