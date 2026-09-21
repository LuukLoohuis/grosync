#!/usr/bin/env bash
# Voert SQL uit op het gekoppelde Supabase-project, via de Management API.
# `supabase db query --linked` werkt op deze machine niet (de tijdelijke loginrol
# wordt geweigerd); dit script gebruikt het token van `supabase login` rechtstreeks.
#
#   scripts/supabase-sql.sh "select count(*) from recipes"
#   scripts/supabase-sql.sh < supabase/migrations/20260921100000_receptfotos.sql
#
# Het antwoord is JSON (een rij per object). Een SQL-fout geeft exitcode 1 en de
# foutmelding van Postgres.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
project_ref="${SUPABASE_PROJECT_REF:-$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$here/../supabase/config.toml")}"
if [ -z "$project_ref" ]; then
  echo "Geen project_id gevonden in supabase/config.toml" >&2
  exit 1
fi

token="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$token" ]; then
  token="$(security find-generic-password -s 'Supabase CLI' -w 2>/dev/null || cat "$HOME/.supabase/access-token" 2>/dev/null || true)"
fi
if [ -z "$token" ]; then
  echo "Geen Supabase-token gevonden; log in met: supabase login" >&2
  exit 1
fi

if [ $# -gt 0 ]; then
  sql="$*"
else
  sql="$(cat)"
fi

body="$(python3 -c 'import json, sys; print(json.dumps({"query": sys.stdin.read()}))' <<< "$sql")"
response="$(curl -sS -X POST "https://api.supabase.com/v1/projects/$project_ref/database/query" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "$body" \
  -w $'\n%{http_code}')"

status="${response##*$'\n'}"
payload="${response%$'\n'*}"
printf '%s\n' "$payload" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$payload"
[ "$status" -lt 400 ]
