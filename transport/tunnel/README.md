# OPSES transport — Cloudflare Tunnel (TLS)

Lets remote employees reach the in-house CISO server
(`server/opses-server.mjs`, port 4319) over the public internet,
TLS-encrypted, **without a corporate VPN**.

This is ordinary web infrastructure — a reverse-proxy tunnel + TLS, the same
mechanism countless SaaS products sit behind. No custom cryptography, no
"unreadable to Cloudflare" scheme. It's a transport concern, not a redesign
of OPSES's privacy model: the capture agent already masks secrets/PII
locally before anything is sent (see `mask()` in `agent/opses-agent.mjs`);
the tunnel just gets that (already-masked) payload from a remote laptop to
the CISO box safely.

## How it works

```
employee laptop --https--> Cloudflare edge --tunnel--> cloudflared (CISO box) --> opses-server.mjs :4319
    (capture agent)          (TLS terminates)             (encrypted link)              (localhost)
```

1. The capture agent (`agent/opses-agent.mjs`) POSTs to an `https://…` URL
   instead of a LAN address — it already reads `OPSES_SERVER` and uses
   `fetch`, which supports https out of the box, so no agent changes were
   needed for this beyond a connectivity self-check (see below).
2. That request is TLS-encrypted from the employee's machine to Cloudflare's
   edge, same as any HTTPS site.
3. Cloudflare relays it, over another encrypted connection, to `cloudflared`
   running on the CISO box, which forwards it to `http://localhost:4319`.
4. The CISO server, its on-disk employee records (`server/data/`), and the
   local Gemma model never leave the building — the tunnel only changes the
   network *path* remote employees take in, not *where* anything is
   processed or stored.

**Security note:** this gives TLS in transit end-to-end (employee ↔ edge,
edge ↔ CISO box). It does **not** make the payload unreadable to Cloudflare
itself — `cloudflared` is a standard reverse-proxy tunnel, not an
end-to-end-encrypted relay, so Cloudflare's edge sees the request the same
way any CDN/reverse-proxy in front of a website does. That's an intentional,
ordinary trust model, not an oversight. Paired with the agent's existing
local masking, raw secrets still never leave the employee's machine in the
clear — only already-redacted data crosses the network at all. (A
zero-knowledge relay where Cloudflare can't read anything, even ciphertext
metadata, is a different, heavier design — see the Durable-Object/E2E
sketch in `docs/superpowers/plans/2026-07-04-opses.md` — and is out of scope
here; this transport is deliberately the simple, standard option.)

## Quick tunnel (demo / pilot)

No Cloudflare account needed. On the CISO box:

```bash
cd transport/tunnel
./setup-tunnel.sh
```

This runs `cloudflared tunnel --url http://localhost:4319` in the
background, waits for `cloudflared` to print its
`https://<random-words>.trycloudflare.com` URL, and prints it back to you
along with the exact command to hand to a remote employee.

Give that URL to remote employees:

```bash
bash install.sh <employee_id> https://<random-words>.trycloudflare.com
```

`install.sh` already accepts the server URL as its 2nd argument (or prompts
for one interactively, or falls back to `$OPSES_SERVER`) — nothing to change
there. Docs only.

Caveats: the URL is random and changes every time you restart the tunnel;
the tunnel dies when `cloudflared` (or this script's background process)
stops. Fine for a demo/pilot, not for standing production use.

Stop it with `kill $(cat cloudflared.pid)`.

## Named tunnel (production)

A stable hostname you control, backed by your own Cloudflare account/zone —
documented in full in the comment header of `setup-tunnel.sh`:

```bash
cloudflared tunnel login                # authorize; downloads ~/.cloudflared/cert.pem
cloudflared tunnel create opses         # writes ~/.cloudflared/<TUNNEL-UUID>.json — NEVER commit this
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: opses
credentials-file: /home/<you>/.cloudflared/<TUNNEL-UUID>.json
ingress:
  - hostname: opses.yourcompany.com
    service: http://localhost:4319
  - service: http_status:404
```

```bash
cloudflared tunnel route dns opses opses.yourcompany.com
cloudflared tunnel run opses
# or run it as a persistent service:
cloudflared service install
```

Employees then install with the stable hostname:

```bash
bash install.sh <employee_id> https://opses.yourcompany.com
```

You can additionally put the hostname behind Cloudflare Access (SSO/MFA) for
defense in depth later — not required for the tunnel itself to work.

## Installing cloudflared

`setup-tunnel.sh` detects a missing `cloudflared` and prints install
instructions instead of failing with a bare command-not-found:

- **Windows:** `winget install --id Cloudflare.cloudflared` (or download the
  `.exe` from the [releases page](https://github.com/cloudflare/cloudflared/releases))
- **macOS:** `brew install cloudflared`
- **Linux:** see the [releases page](https://github.com/cloudflare/cloudflared/releases) for your distro's package
- **Fallback (any OS with Node/npm):** `npm i -g cloudflared`

## Agent connectivity self-check

The capture agent now does a one-shot `GET ${OPSES_SERVER}/` before its
first sync so a mistyped or unreachable server URL (very easy when copying a
tunnel URL around) fails with a clear message instead of a confusing hang or
a bare fetch error. It doesn't change behavior when the server is reachable,
and LAN `http://` URLs keep working exactly as before.

## Files (git-ignored — see repo `.gitignore`)

- `cloudflared.log` — cloudflared's stdout/stderr, created at runtime.
- `cloudflared.pid` — the background tunnel process id, created at runtime.

Tunnel credentials (`~/.cloudflared/*.json`, `cert.pem`) live outside the
repo entirely and are never committed.
