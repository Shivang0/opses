#!/usr/bin/env bash
# OPSES — Cloudflare Tunnel launcher. Run this ON THE CISO BOX.
# Exposes the local OPSES server (default http://localhost:4319) at a public
# HTTPS URL, TLS-encrypted to the Cloudflare edge, so remote employees can
# reach it without a corporate VPN. Standard reverse-proxy infra — no custom
# crypto, no "hide it from Cloudflare" scheme, just a tunnel + TLS.
#
#   Usage:  ./setup-tunnel.sh [local_url]
#   e.g.    ./setup-tunnel.sh http://localhost:4319
#
# This script runs the QUICK TUNNEL (no Cloudflare account needed — good for
# a demo/pilot). For production, set up a NAMED TUNNEL instead:
#
#   1. cloudflared tunnel login
#        Opens a browser to authorize against your Cloudflare account/zone;
#        downloads an origin cert to ~/.cloudflared/cert.pem.
#   2. cloudflared tunnel create opses
#        Registers a tunnel; writes credentials to
#        ~/.cloudflared/<TUNNEL-UUID>.json — NEVER commit this file.
#   3. Write ~/.cloudflared/config.yml:
#        tunnel: opses
#        credentials-file: /home/<you>/.cloudflared/<TUNNEL-UUID>.json
#        ingress:
#          - hostname: opses.yourcompany.com
#            service: http://localhost:4319
#          - service: http_status:404
#   4. cloudflared tunnel route dns opses opses.yourcompany.com
#   5. cloudflared tunnel run opses      (or `cloudflared service install`
#      to run it as a persistent OS service)
#
# See ./README.md for the full write-up (how it works, security notes).
set -euo pipefail

LOCAL_URL="${1:-http://localhost:4319}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/cloudflared.log"
PID_FILE="$SCRIPT_DIR/cloudflared.pid"

echo "──────────────────────────────────────────────"
echo "  OPSES — Cloudflare Tunnel (TLS transport)"
echo "──────────────────────────────────────────────"

# 1) cloudflared check — detect + guide instead of a raw command-not-found.
if ! command -v cloudflared >/dev/null 2>&1; then
  cat <<'EOF'
ERROR: 'cloudflared' is not installed (or not on PATH).

Install it, then re-run this script:

  Windows:  winget install --id Cloudflare.cloudflared
            (or grab the .exe: https://github.com/cloudflare/cloudflared/releases)
  macOS:    brew install cloudflared
  Linux:    see https://github.com/cloudflare/cloudflared/releases for your distro
  Fallback (any OS with Node/npm):  npm i -g cloudflared
EOF
  exit 1
fi

echo "→ Starting quick tunnel for $LOCAL_URL ..."
echo "  (production/named-tunnel setup is documented in this script's header)"
echo

# 2) Launch cloudflared in the background; nohup so it survives this shell
#    exiting (mirrors the install.sh watcher pattern).
: > "$LOG_FILE"
nohup cloudflared tunnel --url "$LOCAL_URL" > "$LOG_FILE" 2>&1 &
CF_PID=$!
echo "$CF_PID" > "$PID_FILE"
disown "$CF_PID" 2>/dev/null || true

# 3) Poll the log for the URL cloudflared prints, e.g.
#    https://random-words-1234.trycloudflare.com
TUNNEL_URL=""
for _ in $(seq 1 30); do
  if ! kill -0 "$CF_PID" 2>/dev/null; then
    echo "ERROR: cloudflared exited early. Log:"
    cat "$LOG_FILE"
    exit 1
  fi
  TUNNEL_URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG_FILE" | head -n1 || true)"
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: timed out waiting for cloudflared to print a tunnel URL. Log:"
  cat "$LOG_FILE"
  exit 1
fi

echo "──────────────────────────────────────────────"
echo "  Tunnel is up  (PID $CF_PID)"
echo "  Public HTTPS URL:  $TUNNEL_URL"
echo
echo "  Remote employees install with:"
echo "    bash install.sh <employee_id> $TUNNEL_URL"
echo
echo "  Stop the tunnel:  kill \$(cat "$PID_FILE")"
echo "  Log:              $LOG_FILE"
echo "──────────────────────────────────────────────"
