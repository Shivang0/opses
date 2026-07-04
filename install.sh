#!/usr/bin/env bash
# OPSES employee installer.
# Sets up the local capture agent that reads THIS machine's Claude Code (+ Cursor)
# usage and streams it — masked — to the in-house OPSES server.
#
#   Usage:  ./install.sh [employee_id] [server_url]
#   e.g.    ./install.sh shivang http://192.168.1.20:4319
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT="$SCRIPT_DIR/agent/opses-agent.mjs"
OPSES_HOME="$HOME/.opses"
mkdir -p "$OPSES_HOME"

echo "──────────────────────────────────────────────"
echo "  OPSES — agentic-AI governance (in-house)"
echo "──────────────────────────────────────────────"

# 1) Node check
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js (>=20) is required. Install it and re-run."
  exit 1
fi

# 2) Employee identity
EMP_ID="${1:-}"
if [ -z "$EMP_ID" ]; then
  read -r -p "Employee ID (e.g. shivang, daniel): " EMP_ID
fi
EMP_ID="$(echo "$EMP_ID" | tr '[:upper:] ' '[:lower:]-' )"
if [ -z "$EMP_ID" ]; then echo "ERROR: employee id is required."; exit 1; fi

read -r -p "Display name [$EMP_ID]: " EMP_NAME
EMP_NAME="${EMP_NAME:-$EMP_ID}"

# 3) Server URL
SERVER="${2:-${OPSES_SERVER:-}}"
if [ -z "$SERVER" ]; then
  read -r -p "OPSES server URL [http://localhost:4319]: " SERVER
  SERVER="${SERVER:-http://localhost:4319}"
fi

# 4) Save config for the watcher
cat > "$OPSES_HOME/config.env" <<EOF
OPSES_EMPLOYEE_ID=$EMP_ID
OPSES_NAME=$EMP_NAME
OPSES_SERVER=$SERVER
EOF
echo "Saved config → $OPSES_HOME/config.env"

# 5) Initial historical sync
echo "→ Syncing your Claude Code history (masked, local-first)..."
OPSES_EMPLOYEE_ID="$EMP_ID" OPSES_NAME="$EMP_NAME" OPSES_SERVER="$SERVER" node "$AGENT"

# 6) Start real-time watcher in the background
if [ -f "$OPSES_HOME/agent.pid" ] && kill -0 "$(cat "$OPSES_HOME/agent.pid")" 2>/dev/null; then
  kill "$(cat "$OPSES_HOME/agent.pid")" 2>/dev/null || true
fi
OPSES_EMPLOYEE_ID="$EMP_ID" OPSES_NAME="$EMP_NAME" OPSES_SERVER="$SERVER" \
  nohup node "$AGENT" --watch > "$OPSES_HOME/agent.log" 2>&1 &
echo $! > "$OPSES_HOME/agent.pid"

echo "──────────────────────────────────────────────"
echo "  ✓ OPSES installed for '$EMP_NAME' ($EMP_ID)"
echo "    Real-time watcher PID: $(cat "$OPSES_HOME/agent.pid")  (log: $OPSES_HOME/agent.log)"
echo "    Streaming to: $SERVER"
echo "    Stop: kill \$(cat $OPSES_HOME/agent.pid)"
echo "──────────────────────────────────────────────"
