<div align="center">

# ▚▞ OPSES

### the control room for agentic AI
**nothing leaves the building.**

`◈ in-house` · `◈ masked on-device` · `◈ reasoned by Gemma 4` · `◈ zero gossip`

</div>

---

> Somewhere in your company, right now, an AI agent has a terminal, opinions about
> your architecture, and a clear view of your `.env` file. It is writing code faster
> than any human can read it, and nobody is entirely sure what it typed into the
> prompt box at 2am.
>
> **OPSES is the one calm adult watching all of it — and it never phones home.**

---

## 👋 hi, what is this

OPSES is a **governance console for agentic AI**. Your developers are pair-programming
with Claude Code, Cursor, Codex, Copilot, Gemini and friends. That is wonderful and
also completely unobserved. Secrets get pasted into prompts. Twenty MCP servers load
on every session. A `CLAUDE.md` quietly balloons to 5,000 tokens. Nobody notices,
because there was never a place to look.

OPSES is the place to look. It watches every coding-agent session across the org,
**masks the secrets on the machine before anything moves**, ships the leftovers to a
box *you* own, and lets an on-device model reason over the whole picture so a CISO can
sleep. It maps everything to real compliance frameworks and hands you the evidence,
already stapled.

Nobody on the team can agree on what OPSES stands for. The current leading theory is
**O**n-**P**rem **S**entinel for **E**very **S**ession. We are not confident. It does
not matter. It works.

---

## 😱 the problem, dramatized

```
   dev  ──"here's our stripe key, fix the webhook"──▶  ☁️ cloud model
    │                                                     │
    │                                              (also: 20 MCP servers,
    │                                               a 5k-token CLAUDE.md,
    │                                               and a shadow tool that
    │                                               can run `ssh`)
    ▼
  CISO: "we do... what... with AI?"      ¯\_(ツ)_/¯
```

Shadow AI is the new shadow IT, except it types. You cannot govern what you cannot
see, and today nobody can see it. OPSES fixes the *see* part, then the *govern* part,
without becoming the thing it warns you about.

---

## 🧠 how it works (the one-way street)

```
 coding agents        on the machine           over the wire            in your building
 ────────────         ──────────────           ────────────            ─────────────────
  Claude Code  ┐                                                        ┌──────────────┐
  Cursor       │      capture ▶ mask ▶  ──▶ Cloudflare zero-knowledge ──▶│  Gemma 4     │
  Codex        ├──▶   (secrets, PII, keys       tunnel (they can't      │  on-device   │
  Copilot      │       stripped HERE)           read it either)          │  reasoning   │
  Gemini ...   ┘                                                        └──────┬───────┘
                                                                               ▼
                                                                        the CISO console
```

It is a **one-way street with no off-ramp to a vendor.** Sensitive context is masked at
the source, the encrypted remainder rides a zero-knowledge tunnel, and every drop of
reasoning happens on hardware you control. The scariest thing OPSES can do is generate
a slightly verbose compliance report.

---

## 🏅 built for the tracks

OPSES is a **Google track** project (**remote participation**), and it leans on two
supporting tracks to make "nothing leaves the building" more than a slogan:

| | track | what it does for OPSES |
|---|---|---|
| 🔵 | **Google** *(remote participation)* | **Gemma 4** is the brain. Every assessment, remediation, compliance narrative and copilot answer is generated **on-device by Gemma 4** — privacy-preserving inference, no vendor round-trip. This is the whole point. |
| 🟠 | **Cloudflare** *(supporting)* | The **zero-knowledge transport**. Masked telemetry rides a Cloudflare tunnel from the endpoint to the in-house core. Cloudflare moves the bytes and cannot read them. |
| 🟢 | **NVIDIA** *(supporting)* | The **muscle**. Production Gemma 4 (`gemma-4-E2B`) runs on NVIDIA GPUs (bf16, `device_map="auto"`) for real-time on-prem inference — the on-device brain, accelerated. |

---

## 🕹️ what's inside the console

Twenty rooms in the control room. A quick tour:

**📊 Analytics** — Dashboard (KPIs, activity heatmap, streaks, token economy), Sessions
(every session, searchable, with a **masked transcript reader** + token sparkline + tool
chips), Costs, Projects (+ per-repo drill-down), Deep Analysis (a clickable **tool-call
audit trail**), Compare.

**🛡️ Oversight** — Developers (risk-scored, each with a **Gemma 4 assessment**), Findings
(with **one-click remediation drafted on-device**), **MCP Registry** (shadow/unapproved
servers flagged), **Context Files** (bloat-weighted `CLAUDE.md` inventory), **Posture**
(per-repo agent-safety grade, A→F), **Compliance** (EU AI Act · ISO/IEC 42001 · NIST AI
RMF, with a **Gemma 4 posture assessment**), **Reports** (full compliance report written
on-device), **Evidence Query** (scoped auditor SQL-lite + CSV), **Evidence Pack** (a dated
SVG compliance snapshot for the audit file), **Copilot** (ask your posture anything;
answered on-device).

**🔌 Connect** — Subscriptions (plans + quotas), Connections (the editor capability
matrix), Relay (masked team context-sharing over MCP), Data controls (retention +
on-device masking policy).

---

## 🚀 run it

Three little servers, all yours:

```bash
# 1. the brain — local Gemma 4 (put your HF token in ~/.opses/hf.env first)
OPSES_GEMMA_MODEL=google/gemma-4-E2B  bash gemma/setup.sh        # :4320

# 2. the in-house core — ingests masked telemetry, derives findings, serves the API
node server/opses-server.mjs                                     # :4319

# 3. the endpoint agent — reads local agent sessions, masks, ships them home
OPSES_EMPLOYEE_ID=you OPSES_NAME="You" OPSES_SERVER=http://localhost:4319 \
  node agent/opses-agent.mjs

# 4. the console
cd web && npm install && npm run dev                             # :5173
```

No Gemma 4 GPU handy? The console still runs — the Gemma-powered panels degrade to
honest templated text and quietly say so. Point `OPSES_GEMMA_MODEL` at a smaller Gemma 4
build in your **untracked** `~/.opses/hf.env` for on-device inference on a laptop.

---

## 🧾 the vibe

- **Nothing leaves the building.** Masked at the source, tunneled zero-knowledge,
  reasoned on-device. If a byte of your prompt reaches a vendor, we have failed.
- **Evidence, not vibes.** Every finding cites a control. Every report has a date.
- **Boring on purpose.** A governance tool that becomes exciting has usually become a
  breach. OPSES aspires to be the least dramatic thing in your stack.

<div align="center">

---

*built with a lot of coffee and a healthy fear of `.env` files.*
**OPSES** · in-house · on-device · off the record.

</div>
