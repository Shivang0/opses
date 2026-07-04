# OPSES — In-House Governance Analyst for Agentic AI
*(chosen name; earlier names considered: WARDEN, KEEP, HEARTH, GLASSBOX, SENTINEL)*

**RAISE Summit 2026 design spec — 2026-07-04**
Team: remote, security/privacy/forensics edge. Primary track: **Gemma** (local, offline, privacy-first). Rubric: **DEMO 50% / IMPACT 25% / CREATIVITY 15% / PITCH 10%**.

---

## 1. Problem & why now

Enterprises rolled out Cursor / Claude Code to every developer in 2025–26 with **zero governance**. Nobody can answer: what data are our devs pasting into models? Which MCP servers and hooks did they wire in (new supply-chain + code-exec attack surface)? What is it costing? Are we defensible under the EU AI Act / ISO 42001 / NIST AI RMF? Existing "AI governance" tools are **cloud dashboards** — which, for a compliance tool, is self-refuting: you'd be shipping every employee's prompts (their PII, secrets, private context) to a third-party cloud, *creating* the breach you're paid to prevent.

## 2. What it is (one line)

**An in-house agent that ingests every developer's agentic-AI telemetry, and — running entirely on the CISO's own machine — produces per-developer "AI-hygiene + risk" findings and cited compliance evidence, without a single prompt ever leaving the building.**

The **hero is the agent's cited findings and the live "catch," not a metrics screen.** The CISO rollup is a byproduct view — deliberately *not* the main feature (that's what keeps us off the banned-dashboard list).

## 3. Users

- **Primary buyer:** CISO / security & compliance lead — needs defensible evidence and to know *which devs to coach*, without becoming a surveillance operator.
- **Secondary user:** the developer — gets specific, non-punitive "clean up your setup" fixes (context bloat, cost, risky config).

## 4. Architecture (all private data stays in-house)

**Plane 1 — Capture (every employee machine):**
- **Cursor** → `LangGuard-AI/cursor-otel-hook` (Cursor IDE hooks → OTLP spans: prompts, responses, models, tool calls, MCP calls, session IDs; ships MDM `.pkg`/`.msi`, has `privacy.py`).
- **Claude Code** → native OpenTelemetry (`CLAUDE_CODE_ENABLE_TELEMETRY`: tokens/cost/model/session) + hooks (`UserPromptSubmit`, `PreToolUse`/`PostToolUse`) + transcripts (`~/.claude/projects/**/*.jsonl`).
- **Config-scanner** (small addition): inventories installed MCP servers, CLAUDE.md, hooks, skills, settings → ships a manifest.
- **Mask locally** (`privacy.py` + a small local classifier): PII/secrets/personal content redacted **before anything leaves the machine**.
- **E2E envelope-encrypt** the masked batch with the CISO box's public key (libsodium sealed-box / `age`).

**Plane 2 — Transport (zero-knowledge):**
- **Cloudflare** Worker + one **Durable Object per employee** (ordered buffer, reconnection, backpressure) *or* **Cloudflare Tunnel** (CISO box needs no open inbound ports). Cloudflare only ever moves **ciphertext it cannot read** → onboards remote/WFH employees with no VPN. **Infra, never inference.**

**Plane 3 — Reason (the CISO's box, in-house core):**
- **Gemma 4 local** = the analysis agent. Decrypts locally, reasons over the private telemetry, emits per-dev findings + fixes. **Privacy is the product; Gemma is load-bearing (a cloud call *would be* the leak).**
- **Local NVIDIA Nemotron (self-hosted NIM on the RTX)** = risk-classifier sub-agent (MCP/hook danger scoring, span parsing). In-house → wins RTX 5080 without breaking sovereignty.

**Plane 4 — Compliance rulebook (public data only):**
- **Vultr Serverless Inference** reasons over the **PUBLIC** regulation corpus (EU AI Act articles, ISO/IEC 42001 controls, NIST AI RMF functions) to build a structured, **cited** control library ({control_id, requirement, what-to-check, citation}). It **never touches private employee data** — so no sovereignty breach — and it's a genuine document-grounded, multi-retrieval, cited Vultr *component*. Gemma-local maps its private findings onto this rulebook to produce evidence records.

## 5. Privacy-by-design (this is also the killer-question defense)

A judge *will* ask: *"isn't shipping every employee's prompts to the CISO itself GDPR-violating surveillance?"* The architecture is the answer: **mask at the endpoint → E2E-encrypt → blind relay → the CISO's Gemma reasons over masked evidence + metadata, never raw prompts.** Governance *without* surveillance. Lead the pitch with this.

## 6. The hero output

Per-developer report, e.g.:
> **Dev A:** 55 MCP servers load ~41K tokens before the first prompt → drop these 6 (save ~$X/day). CLAUDE.md is 3.2K tokens of stale rules → 400-token rewrite performs the same. ⚠️ hook `notify.sh` POSTs AWS creds to `evil.com` [evidence]. ⚠️ customer PII → cloud model, Jul 2 [masked evidence] → **EU AI Act Art. 10 data-governance flag** [Vultr citation].

Plus: compliance-evidence records mapped to the frameworks, and a CISO rollup (coaching priorities) as a *secondary* view.

## 7. The winning demo (falsifiable "catch")

Planted "employee" whose setup has (a) 55 MCPs, (b) a bloated CLAUDE.md, (c) a hook exfiltrating creds to a webhook, (d) a PII-leaking prompt. Run OPSES live → it catches all four **with exact evidence** and cites the regulation → then **pull the network cable and it keeps running.** Nothing left the building. This is *falsifiability-as-spectacle* (the pattern our critique found wins) + the team's security DNA.

## 8. Track & prize stack

- **Primary track: Gemma** (local/offline/privacy-first core).
- **Prize surface (all in-house-compatible):** Gemma (core) + **Cloudflare $5k** (zero-knowledge transport) + **Vultr** (public-regulation reasoner, cited) + **NVIDIA RTX 5080** (local Nemotron/NIM) + **SUSE** (on-prem/Rancher deploy). ~5 prizes with the sovereignty story fully intact. (Nebius optional: an *offline* fine-tune of the hygiene model, deployed locally.)

## 9. Rubric mapping

- **DEMO (50%):** no cloud on the private path → nothing to flake; the "pull the cable" catch is reliable + rehearsable.
- **IMPACT (25%):** real, urgent 2026 enterprise pain; clear buyer (CISO); fits the governance/compliance problem statement; data-sovereignty is a hard requirement, not a nice-to-have.
- **CREATIVITY (15%):** "governance without surveillance" + "cross-examine your team's AI hygiene" is a fresh interaction; the zero-knowledge relay is a novel flex.
- **PITCH (10%):** cold-open on a real shadow-AI incident; the masking story pre-empts the killer question.

## 10. MVP scope for 48h (YAGNI — build only the demo path)

**In:** unified OTLP collector; **Claude Code** capture (native, most reliable) + **Cursor** via `cursor-otel-hook`; config-scanner; endpoint mask + E2E encrypt; Cloudflare relay (DO or Tunnel); Gemma-local analysis producing the 4 planted findings; Vultr rulebook for ~3–4 specific controls (enough to cite the demo findings); the per-dev report + the pull-the-cable moment.

**Out (roadmap, say so out loud):** full framework coverage, polished CISO UI, fine-tuned models, SUSE production deploy, historical trend views, >1 employee at scale.

## 11. Risks & mitigations

- **Surveillance optics** → endpoint masking + E2E encryption is the spine of the pitch, not a footnote.
- **"Is Gemma actually load-bearing?"** → yes: local reasoning is the *only* way to analyze sensitive data without leaking it; make Gemma do genuine contextual risk reasoning, not just templating.
- **Feasibility of live capture** → anchor the live demo on Claude Code (fully controllable: OTel + hooks + transcripts + local files); Cursor via the existing hook project; pre-provision the planted machine.
- **Adjacency to graveyarded CLOAK** (on-device DLP) → differentiate hard: OPSES's surface is the *agentic* attack surface (MCP/hooks/skills/config supply-chain) + org-level compliance evidence, not screen-share pixels.
- **Vultr is a component, not a full track entry** → be explicit; primary track is Gemma. Don't over-claim Vultr-track eligibility.

## 12. Resolved decisions (locked 2026-07-04)

- **Name:** **OPSES** — the security-&-compliance ops layer for agentic dev tools (Cursor/Claude Code). Earlier names considered: WARDEN, KEEP.
- **Cloudflare transport:** **Durable Object per employee** (buffering/reconnection + stronger prize story); Tunnel is the fallback if time gets tight.
- **Demo scale:** **1 richly-planted machine** (the live "catch") **+ 2 lightweight** employees for the CISO rollup shot.
- **Controls hard-supported** (one per planted finding): **EU AI Act Art. 10** (PII→cloud), **ISO/IEC 42001** supply-chain/third-party control (malicious MCP/hook), **NIST AI RMF MAP** (shadow-AI inventory), **+ a cost/resource control** (context/token bloat).
