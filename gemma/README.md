# OPSES local Gemma — privacy-first, on-device inference

Runs a Gemma model **entirely on the CISO box** (nothing leaves the machine). OPSES's node server proxies to it at `/api/gemma` for remediation / CLAUDE.md compression / plain-language explanations — and **falls back to templated text if this server isn't running**, so OPSES never breaks.

## Run it

```bash
# put your HF token here once (gitignored, outside the repo):
echo 'HF_TOKEN=hf_xxx' > ~/.opses/hf.env

# production model (Gemma 4) — needs a GPU or ~12GB+ free RAM:
OPSES_GEMMA_MODEL=google/gemma-4-E2B  bash gemma/setup.sh

# laptop-friendly fallback model (see gating note below):
OPSES_GEMMA_MODEL=google/gemma-3-270m-it  bash gemma/setup.sh
```
`setup.sh` upgrades `transformers` (Gemma 4 needs >= 5.10), downloads the model once, and starts the server on `:4320` (loads in the background). Check: `curl localhost:4320/health`.

## Verified facts (from this build session)
- ✅ Token has access to **`google/gemma-4-E2B`** (`gated=false`, files download 200).
- ✅ After `pip install -U transformers` (→ 5.13), **`Gemma4ForConditionalGeneration` is available** and transformers loads the gemma-4-E2B config as `Gemma4Config` (`model_type: gemma4`). The GPU path (`device_map="auto"`, bf16) is wired in `gemma_server.py`.
- ⚠️ It could **not** run inside the build sandbox: the E2B weights are ~10 GB and the sandbox had only ~3.5 GB free RAM. This is a hardware limit, not a code/token problem — it runs on a box with enough RAM/VRAM.

## Troubleshooting
- **HTTP 403 on model files** → that model is license-gated (`gated=manual`) for your HF account. Open its page on huggingface.co and click "Agree/Access" once (the `gemma-3-*` and `gemma-2-*` models need this; `gemma-4-E2B` did not for this token).
- **`ImportError: Gemma4ForConditionalGeneration`** → `pip install -U transformers` (needs >= 5.10). `setup.sh` does this with `-U`.
- **OOM / very slow on CPU** → use a smaller model (`gemma-3-270m-it`) or a GPU box. E2B in bf16 needs ~10 GB.
- **Windows symlink warning** → harmless; `setup.sh` sets `HF_HUB_DISABLE_SYMLINKS_WARNING=1`.

## Swap the model
Any HF causal-LM id works via `OPSES_GEMMA_MODEL`. `gemma-4-E2B` is the production target; the code, wiring, and fallback are model-agnostic.
