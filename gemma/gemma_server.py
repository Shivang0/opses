#!/usr/bin/env python
"""OPSES local Gemma inference — on-device (CISO box), privacy-first. Nothing leaves the machine.

Default model fits a low-RAM CPU; on a GPU / big-RAM box set:
    OPSES_GEMMA_MODEL=google/gemma-4-E2B   (the production Gemma 4 target)

Loads OFFLINE from OPSES_GEMMA_DIR when provided (see gemma/setup.sh), else pulls by id.
Serves a tiny HTTP API the OPSES node server proxies to:
    GET  /health      -> {ok, model, error}
    POST /generate    -> {text, model}   body: {prompt, system?, max_new_tokens?}
"""
import os
import json
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Load HF token from the gitignored env file if present.
_envp = os.path.expanduser("~/.opses/hf.env")
if os.path.exists(_envp):
    for _line in open(_envp, encoding="utf-8"):
        _line = _line.strip()
        if "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k, _v)

MODEL = os.environ.get("OPSES_GEMMA_MODEL", "google/gemma-3-270m-it")
MODEL_DIR = os.environ.get("OPSES_GEMMA_DIR")  # local dir for offline load
PORT = int(os.environ.get("OPSES_GEMMA_PORT", "4320"))
TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

STATE = {"loaded": False, "error": None, "model": MODEL, "tok": None, "m": None}


def _load():
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        offline = bool(MODEL_DIR and os.path.isdir(MODEL_DIR))
        src = MODEL_DIR if offline else MODEL
        kw = {} if offline else {"token": TOKEN}
        cuda = torch.cuda.is_available()
        print(f"OPSES Gemma: loading {src} ({'GPU' if cuda else 'CPU'}) ...", flush=True)
        t0 = time.time()
        tok = AutoTokenizer.from_pretrained(src, **kw)
        load_kw = dict(low_cpu_mem_usage=True, **kw)
        if cuda:  # e.g. gemma-4-E2B on a GPU box
            load_kw["device_map"] = "auto"
            load_kw["dtype"] = torch.bfloat16
        else:
            load_kw["dtype"] = torch.float32
        try:
            m = AutoModelForCausalLM.from_pretrained(src, **load_kw)
        except TypeError:  # older transformers: dtype -> torch_dtype
            load_kw["torch_dtype"] = load_kw.pop("dtype")
            m = AutoModelForCausalLM.from_pretrained(src, **load_kw)
        m.eval()
        STATE.update(loaded=True, tok=tok, m=m)
        print(f"OPSES Gemma: ready ({src}) on {'GPU' if cuda else 'CPU'} in {time.time() - t0:.1f}s", flush=True)
    except Exception as e:  # noqa: BLE001 — surface any load failure via /health
        STATE["error"] = str(e)
        print(f"OPSES Gemma: load FAILED: {e}", flush=True)


def _generate(prompt, system=None, max_new_tokens=256):
    import torch

    tok, m = STATE["tok"], STATE["m"]
    msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    try:
        ids = tok.apply_chat_template(msgs, add_generation_prompt=True, return_tensors="pt")
    except Exception:
        ids = tok((system + "\n\n" if system else "") + prompt, return_tensors="pt").input_ids
    try:
        ids = ids.to(next(m.parameters()).device)
    except Exception:
        pass
    with torch.no_grad():
        out = m.generate(ids, max_new_tokens=int(max_new_tokens), do_sample=False)
    return tok.decode(out[0][ids.shape[1]:], skip_special_tokens=True).strip()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": STATE["loaded"], "model": STATE["model"], "error": STATE["error"]})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/generate":
            return self._send(404, {"error": "not found"})
        if not STATE["loaded"]:
            return self._send(503, {"error": "model not loaded", "detail": STATE["error"]})
        n = int(self.headers.get("content-length", 0) or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._send(400, {"error": "bad json"})
        try:
            txt = _generate(body.get("prompt", ""), body.get("system"), body.get("max_new_tokens", 256))
            self._send(200, {"text": txt, "model": STATE["model"]})
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(target=_load, daemon=True).start()  # load in background; /health answers immediately
    print(f"OPSES Gemma server: http://127.0.0.1:{PORT}  (model: {MODEL})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
