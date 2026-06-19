#!/usr/bin/env bash
# Generates a fresh set of self-hosted Supabase secrets for .env.
#
# The default values shipped in .env.example are the well-known public
# Supabase demo secrets — fine for a throwaway local test, but anyone who
# finds them can sign their own admin tokens. Run this before exposing the
# stack beyond localhost (and before storing any real user data).
#
# Usage:
#   sh supabase/generate-secrets.sh
#
# Copy the printed values into your .env file (do not commit .env).
set -euo pipefail

JWT_SECRET=$(openssl rand -hex 32)

sign_jwt() {
  local role="$1"
  local secret="$2"
  local header payload header_b64 payload_b64 signing_input signature

  header='{"alg":"HS256","typ":"JWT"}'
  # 10 year expiry, matches upstream demo key lifetime
  local iat=$(date +%s)
  local exp=$((iat + 315360000))
  payload=$(printf '{"role":"%s","iss":"supabase-self-hosted","iat":%d,"exp":%d}' "$role" "$iat" "$exp")

  header_b64=$(printf '%s' "$header" | base64 | tr '+/' '-_' | tr -d '=\n')
  payload_b64=$(printf '%s' "$payload" | base64 | tr '+/' '-_' | tr -d '=\n')
  signing_input="${header_b64}.${payload_b64}"
  signature=$(printf '%s' "$signing_input" | openssl dgst -sha256 -hmac "$secret" -binary | base64 | tr '+/' '-_' | tr -d '=\n')

  printf '%s.%s' "$signing_input" "$signature"
}

ANON_KEY=$(sign_jwt "anon" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(sign_jwt "service_role" "$JWT_SECRET")

cat <<EOF
# Paste these into .env, replacing the demo values:

POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SECRET_KEY_BASE=$(openssl rand -hex 32)
VAULT_ENC_KEY=$(openssl rand -hex 16)
PG_META_CRYPTO_KEY=$(openssl rand -hex 16)
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$(openssl rand -hex 16)
POOLER_TENANT_ID=$(openssl rand -hex 8)
S3_PROTOCOL_ACCESS_KEY_ID=$(openssl rand -hex 16)
S3_PROTOCOL_ACCESS_KEY_SECRET=$(openssl rand -hex 32)
EOF
