#!/usr/bin/env bash
# Copy every filled-in value from .env into the Vercel project (production).
# Empty keys are skipped, so it runs before the Meta app exists. Re-runnable:
# existing keys are replaced. Values are never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
missing=$(grep -E '^[A-Z_]+=$' .env | cut -d= -f1 || true)
[ -n "$missing" ] && echo "Skipping, still empty: $missing"
grep -E '^[A-Z_]+=.+' .env | while IFS= read -r line; do
  k=${line%%=*}; v=${line#*=}
  vercel env rm "$k" production --yes >/dev/null 2>&1 || true
  printf %s "$v" | vercel env add "$k" production >/dev/null
  echo "  set $k"
done
