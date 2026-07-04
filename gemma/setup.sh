#!/usr/bin/env bash
# OPSES local Gemma — run on the CISO box to enable privacy-first, on-device inference.
# Downloads the model with your HF token and starts the local inference server on :4320.
#
#   Default model:  gemma-3-270m-it   (fits low-RAM CPU)
#   Production:      OPSES_GEMMA_MODEL=google/gemma-4-E2B ./setup.sh   (GPU / 16GB+ free RAM)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="${OPSES_GEMMA_MODEL:-google/gemma-3-270m-it}"
TARGET="$HOME/.opses/models/$(echo "$MODEL" | tr '/' '_')"

# HF token must live in the gitignored env file (never in code / never committed)
if [ ! -f "$HOME/.opses/hf.env" ]; then
  echo "ERROR: put your token in ~/.opses/hf.env first:  echo 'HF_TOKEN=hf_xxx' > ~/.opses/hf.env"
  exit 1
fi
# shellcheck disable=SC1090
source "$HOME/.opses/hf.env"

echo "OPSES Gemma setup — model: $MODEL  ->  $TARGET"
export HF_HUB_DISABLE_SYMLINKS_WARNING=1
# -U so transformers is new enough for the Gemma 4 architecture (needs >=5.10)
python -m pip install -q -U -r "$DIR/requirements.txt"

echo "→ Downloading model (one time)..."
python - "$MODEL" "$TARGET" <<'PY'
import os, sys
from huggingface_hub import snapshot_download
model, target = sys.argv[1], sys.argv[2]
snapshot_download(model, token=os.environ.get("HF_TOKEN"), local_dir=target,
                  allow_patterns=["*.json", "*.model", "*.safetensors", "*.txt"])
print("downloaded to", target)
PY

echo "→ Starting local Gemma server on :4320 (loads in background)..."
if [ -f "$HOME/.opses/gemma.pid" ] && kill -0 "$(cat "$HOME/.opses/gemma.pid")" 2>/dev/null; then
  kill "$(cat "$HOME/.opses/gemma.pid")" 2>/dev/null || true
fi
OPSES_GEMMA_MODEL="$MODEL" OPSES_GEMMA_DIR="$TARGET" \
  nohup python "$DIR/gemma_server.py" > "$HOME/.opses/gemma.log" 2>&1 &
echo $! > "$HOME/.opses/gemma.pid"

echo "──────────────────────────────────────────────"
echo "  ✓ Local Gemma starting (PID $(cat "$HOME/.opses/gemma.pid"), log: ~/.opses/gemma.log)"
echo "    Check readiness:  curl http://localhost:4320/health"
echo "    OPSES will use it automatically for remediation/compression; if it's not ready,"
echo "    OPSES falls back to templated text so nothing breaks."
echo "──────────────────────────────────────────────"
