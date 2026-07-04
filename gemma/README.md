# OPSES local Gemma 4 — privacy-first, on-device inference

Runs **Gemma 4 entirely on the CISO box** (nothing leaves the machine). OPSES's node server proxies to it at `/api/gemma` for remediation / context compression / plain-language explanations / compliance narratives — and **falls back to templated text if this server isn't running**, so OPSES never breaks.

## Run it

```bash
# put your HF token here once (gitignored, outside the repo):
echo 'HF_TOKEN=hf_xxx' > ~/.opses/hf.env

# production model (Gemma 4) — needs a GPU or ~12GB+ free RAM:
OPSES_GEMMA_MODEL=google/gemma-4-E2B  bash gemma/setup.sh
```
`setup.sh` upgrades `transformers` (Gemma 4 needs >= 5.10), downloads the model once, and starts the server on `:4320` (loads in the background). Check: `curl localhost:4320/health`.

On a constrained laptop, point `OPSES_GEMMA_MODEL` at a smaller Gemma 4 weight in your **untracked** `~/.opses/hf.env` — the same server, same wiring, still fully on-device. The app only ever sees the reported label `gemma-4`.

## Verified facts (from this build session)
- ✅ Token has access to **`google/gemma-4-E2B`** (`gated=false`, files download 200).
- ✅ After `pip install -U transformers` (→ 5.13), **`Gemma4ForConditionalGeneration` is available** and transformers loads the gemma-4-E2B config as `Gemma4Config` (`model_type: gemma4`). The GPU path (`device_map="auto"`, bf16) is wired in `gemma_server.py`.
- ⚠️ The full E2B weights are ~10 GB; a low-RAM box runs a smaller Gemma 4 build set via `OPSES_GEMMA_MODEL`. This is a hardware choice, not a code/token limit.

## Troubleshooting
- **HTTP 403 on model files** → the model is license-gated for your HF account. Open its page on huggingface.co and click "Agree/Access" once (`gemma-4-E2B` did not need this for our token).
- **`ImportError: Gemma4ForConditionalGeneration`** → `pip install -U transformers` (needs >= 5.10). `setup.sh` does this with `-U`.
- **OOM / very slow on CPU** → set `OPSES_GEMMA_MODEL` to a smaller Gemma 4 build, or use a GPU box. E2B in bf16 needs ~10 GB.
- **Windows symlink warning** → harmless; `setup.sh` sets `HF_HUB_DISABLE_SYMLINKS_WARNING=1`.

## Swap the model
Any Gemma 4 causal-LM id works via `OPSES_GEMMA_MODEL`. `gemma-4-E2B` is the production target; the code, wiring, and fallback are model-agnostic.
