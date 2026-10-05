#!/usr/bin/env bash
# Writes .env from the running local Supabase stack. These are the throwaway keys the
# Supabase CLI hands out for local development. The file is gitignored.
set -euo pipefail
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
cat > .env <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
STRIPE_SECRET_KEY=sk_test_123
STRIPE_WEBHOOK_SECRET=whsec_fake_for_local_demo
STRIPE_API_HOST=127.0.0.1
STRIPE_API_PORT=12111
STRIPE_API_PROTOCOL=http
APP_URL=http://localhost:3000
IMPORT_ALLOWED_HOSTS=catalog.example.com
# Armed trap for F02. Nothing in the fixed app reads this variable. If code ever starts reading it,
# the service role key is inlined into the browser bundle and the bundle check fails.
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
ENV
echo "wrote .env"
