#!/usr/bin/env node
// OPSES in-house server - runs on the CISO machine only.
// Ingests employee payloads (already masked at the endpoint), derives compliance
// findings, and serves the dashboard API + a live SSE stream. Zero external deps.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.OPSES_PORT || 4319)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })
const GEMMA_URL = (process.env.OPSES_GEMMA_URL || 'http://127.0.0.1:4320').replace(/\/$/, '')

/** @type {Map<string, any>} */
const employees = new Map()
const sseClients = new Set()

// ---------- persistence ----------
function load() {
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!f.endsWith('.json')) continue
    try { const e = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); employees.set(e.id, e) } catch {}
  }
  console.log(`OPSES server: loaded ${employees.size} employee record(s) from disk`)
}
function persist(e) {
  try { fs.writeFileSync(path.join(DATA_DIR, `${e.id}.json`), JSON.stringify(e, null, 2)) } catch (err) { console.error('persist failed', err.message) }
}

// ---------- governance policy (data controls) ----------
const POLICY_FILE = path.join(DATA_DIR, '_policy.json')
const DEFAULT_POLICY = {
  retentionDays: 90,
  masking: { secrets: true, apiKeys: true, pii: true, emails: false },
  scopedOut: [], // project folders excluded from all analytics
}
function loadPolicy() {
  try { return { ...DEFAULT_POLICY, ...JSON.parse(fs.readFileSync(POLICY_FILE, 'utf8')) } } catch { return { ...DEFAULT_POLICY } }
}
function savePolicy(p) {
  try { fs.writeFileSync(POLICY_FILE, JSON.stringify(p, null, 2)) } catch (err) { console.error('policy save failed', err.message) }
}

// Which MCP servers are on the approved policy allowlist (shared by /api/mcps + posture).
const APPROVED_MCP = new Set(['filesystem', 'git', 'github', 'memory', 'fetch', 'time', 'sequential-thinking', 'playwright', 'postgres', 'sqlite', 'context7', 'sentry', 'puppeteer', 'brave-search', 'slack'])

// ---------- analytics helpers ----------
const DAY_MS = 86400000
const dayISO = (t) => new Date(t).toISOString().slice(0, 10)
// current + longest run of consecutive active days from a list of 'YYYY-MM-DD'
function streakOf(dates) {
  const set = new Set(dates)
  if (!set.size) return { current: 0, longest: 0 }
  let longest = 0
  for (const d of set) {
    if (set.has(dayISO(new Date(d).getTime() - DAY_MS))) continue // not a run start
    let n = 0, cur = d
    while (set.has(cur)) { n++; cur = dayISO(new Date(cur).getTime() + DAY_MS) }
    if (n > longest) longest = n
  }
  const sorted = [...set].sort()
  let current = 1
  for (let i = sorted.length - 1; i > 0; i--) {
    if (dayISO(new Date(sorted[i]).getTime() - DAY_MS) === sorted[i - 1]) current++
    else break
  }
  return { current, longest }
}

// ---------- static "detected config" payloads (served in-house) ----------
// Editor subscription plans + quotas OPSES reads from each seat's local config.
const SUBSCRIPTIONS = [
  { editor: 'Claude Code', plan: 'Max 20x', status: 'active', used: 68, limit: 100, unit: 'weekly quota', renews: 'Resets Monday', rateLimit: '~900 msgs / 5h', note: 'Primary in-house agent' },
  { editor: 'Cursor', plan: 'Business', status: 'active', used: 41, limit: 100, unit: 'fast requests', renews: 'Renews Jul 28', rateLimit: '500 fast req / mo', note: 'Seat-pooled' },
  { editor: 'GitHub Copilot', plan: 'Enterprise', status: 'active', used: 22, limit: 100, unit: 'premium requests', renews: 'Renews Aug 1', rateLimit: '1000 premium req / mo', note: '' },
  { editor: 'Codex', plan: 'ChatGPT Team', status: 'active', used: 55, limit: 100, unit: 'message cap', renews: 'Resets daily', rateLimit: '150 msgs / 3h', note: '' },
  { editor: 'Gemini CLI', plan: 'Free tier', status: 'trial', used: 12, limit: 100, unit: 'daily requests', renews: 'Resets 00:00 UTC', rateLimit: '1000 req / day', note: '' },
  { editor: 'Devin', plan: 'Team', status: 'inactive', used: 0, limit: 100, unit: 'ACU credits', renews: '250 ACU / mo', rateLimit: '3 concurrent', note: 'Not running - start Devin to scan' },
]
// Which telemetry OPSES can capture per supported editor. yes | no | warn.
const CONNECTIONS = {
  note: 'Devin, Devin Next, and Antigravity must be running during scan.',
  editors: [
    { editor: 'Cursor', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Devin', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Devin Next', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Antigravity', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Claude Code', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'VS Code', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'VS Code Insiders', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Zed', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'no' },
    { editor: 'OpenCode', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Codex', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Gemini CLI', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'GitHub Copilot', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'yes' },
    { editor: 'Cursor Agent', msgs: 'yes', tools: 'no', models: 'no', tokens: 'no' },
    { editor: 'Command Code', msgs: 'yes', tools: 'yes', models: 'no', tokens: 'no' },
    { editor: 'Goose', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'no' },
    { editor: 'Kiro', msgs: 'yes', tools: 'yes', models: 'yes', tokens: 'no' },
    { editor: 'Codebuff', msgs: 'yes', tools: 'yes', models: 'warn', tokens: 'warn' },
  ],
}
// Relay: share masked session context across the team over a local MCP server.
const RELAY = {
  status: 'online',
  server: 'opses-relay',
  endpoint: 'mcp://relay.opses.local:7420',
  protocol: 'MCP 2026-03-26',
  sharedContexts: [
    { id: 'ctx-01', name: 'observer-sessions bring-up', project: 'observer-sessions', sessions: 16, tokens: 2_400_000, sharedBy: 'shivang', updatedAt: '2026-07-04T17:40:00Z', members: ['shivang', 'daniel'] },
    { id: 'ctx-02', name: 'cv console redesign', project: 'cv', sessions: 36, tokens: 5_100_000, sharedBy: 'shivang', updatedAt: '2026-07-04T18:02:00Z', members: ['shivang'] },
  ],
  members: [
    { id: 'shivang', name: 'Shivang', role: 'Owner', contexts: 2 },
    { id: 'daniel', name: 'Daniel', role: 'Engineer', contexts: 1 },
  ],
}

// ---------- derive compliance findings from real captured data ----------
function deriveFindings(e) {
  const findings = []
  const claude = e.tools?.['Claude Code']
  const cfg = e.config || {}

  if (claude?.sessions) {
    for (const s of claude.sessions) {
      const leaks = s.leaks || []
      if (!leaks.length) continue
      const kinds = [...new Set(leaks.flatMap((l) => l.kinds))]
      findings.push({
        id: `${e.id}-${s.id}-pii`, dev: e.id, kind: 'pii_leak', severity: 'high',
        title: leaks.length > 1 ? `Secret sent to a cloud model (${leaks.length}x)` : 'Secret sent to a cloud model',
        detail: `${leaks.length} prompt(s) in "${s.project}" contained ${kinds.join(', ')} and were sent to ${s.models[0] || 'a cloud model'}.`,
        evidence: `${kinds.join(', ')} · ${leaks.length} occurrence(s) · session ${s.id.slice(0, 8)}`,
        control: 'EU AI Act Art. 10', citation: 'Data governance & management (Art. 10(2)(f))',
        detectedAt: s.endedAt,
      })
    }
  }
  const mcpCount = (cfg.mcpServers || []).length
  if (mcpCount > 20) {
    findings.push({
      id: `${e.id}-mcp`, dev: e.id, kind: 'mcp_bloat', severity: 'medium',
      title: `${mcpCount} MCP servers inflate startup context`,
      detail: `${mcpCount} MCP servers load on every session. Review and drop the unused ones.`,
      evidence: `${mcpCount} MCP servers configured`,
      control: 'NIST AI RMF', citation: 'MAP 3.4 - inventory & resource use',
      detectedAt: e.updatedAt, savingsUSDPerDay: Number((mcpCount * 0.12).toFixed(1)),
    })
  } else if (mcpCount > 8) {
    findings.push({
      id: `${e.id}-mcp`, dev: e.id, kind: 'mcp_bloat', severity: 'low',
      title: `${mcpCount} MCP servers configured`, detail: 'Minor context cleanup available.',
      evidence: `${mcpCount} MCP servers configured`, control: 'NIST AI RMF', citation: 'MAP 3.4 - inventory & resource use',
      detectedAt: e.updatedAt, savingsUSDPerDay: 0.6,
    })
  }
  if ((cfg.claudeMdTokens || 0) > 2000) {
    findings.push({
      id: `${e.id}-md`, dev: e.id, kind: 'claudemd_bloat', severity: 'low',
      title: `CLAUDE.md is ~${cfg.claudeMdTokens} tokens`, detail: 'A trimmed rewrite can preserve the operative rules at a fraction of the size.',
      evidence: `~${cfg.claudeMdTokens} tokens loaded every session`, control: 'NIST AI RMF', citation: 'MAP 3.4 - resource efficiency',
      detectedAt: e.updatedAt, savingsUSDPerDay: 1.1,
    })
  }
  return findings
}

function summarize(e) {
  const cc = e.tools?.['Claude Code']?.totals || { sessions: 0, tokensIn: 0, tokensOut: 0, costUSD: 0 }
  const findings = e.findings || []
  return {
    id: e.id, name: e.name, host: e.host, os: e.os, updatedAt: e.updatedAt,
    tools: Object.keys(e.tools || {}).filter((t) => e.tools[t].installed),
    sessions: cc.sessions, tokens: cc.tokensIn + cc.tokensOut, costUSD: cc.costUSD,
    mcpCount: (e.config?.mcpServers || []).length,
    openFindings: findings.length,
    highFindings: findings.filter((f) => f.severity === 'high').length,
    riskScore: Math.min(100, findings.reduce((s, f) => s + ({ high: 40, medium: 15, low: 5 }[f.severity] || 0), 0)),
  }
}

function broadcast(event) {
  const msg = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) { try { res.write(msg) } catch {} }
}

// ---------- http ----------
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}
function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', ...CORS })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const parts = url.pathname.split('/').filter(Boolean)

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }

  // POST /ingest/:id
  if (req.method === 'POST' && parts[0] === 'ingest' && parts[1]) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let payload
      try { payload = JSON.parse(body) } catch { return json(res, 400, { error: 'invalid json' }) }
      payload.id = decodeURIComponent(parts[1])
      payload.findings = deriveFindings(payload)
      employees.set(payload.id, payload)
      persist(payload)
      broadcast({ type: 'update', id: payload.id, at: payload.updatedAt })
      json(res, 200, { ok: true, id: payload.id, findings: payload.findings.length })
    })
    return
  }

  // GET /api/stream (SSE)
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', ...CORS })
    res.write(`data: ${JSON.stringify({ type: 'hello', employees: employees.size })}\n\n`)
    sseClients.add(res)
    req.on('close', () => sseClients.delete(res))
    return
  }

  // GET /api/employees
  if (req.method === 'GET' && url.pathname === '/api/employees') {
    return json(res, 200, [...employees.values()].map(summarize))
  }

  // GET /api/employees/:id  (full record)
  if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'employees' && parts[2]) {
    const e = employees.get(decodeURIComponent(parts[2]))
    if (!e) return json(res, 404, { error: 'not found' })
    return json(res, 200, e)
  }

  // GET /api/org  (aggregate KPIs for the overview)
  if (req.method === 'GET' && url.pathname === '/api/org') {
    const list = [...employees.values()]
    const findings = list.flatMap((e) => e.findings || [])
    const costMTD = list.reduce((s, e) => s + (e.tools?.['Claude Code']?.totals?.costUSD || 0), 0)
    const tokensMTD = list.reduce((s, e) => s + (e.tools?.['Claude Code']?.totals?.tokensIn || 0) + (e.tools?.['Claude Code']?.totals?.tokensOut || 0), 0)
    const toolCounts = {}
    for (const e of list) for (const t of Object.keys(e.tools || {})) if (e.tools[t].installed) toolCounts[t] = (toolCounts[t] || 0) + 1
    return json(res, 200, {
      activeDevs: list.length,
      openFindings: findings.length,
      bySeverity: { high: findings.filter((f) => f.severity === 'high').length, medium: findings.filter((f) => f.severity === 'medium').length, low: findings.filter((f) => f.severity === 'low').length },
      costMTD: Number(costMTD.toFixed(2)), tokensMTD,
      complianceScore: Math.max(0, 100 - findings.reduce((s, f) => s + ({ high: 12, medium: 5, low: 2 }[f.severity] || 0), 0)),
      toolSplit: Object.entries(toolCounts).map(([name, value]) => ({ name, value })),
    })
  }

  // GET /api/activity  (daily token/cost buckets from real sessions)
  if (req.method === 'GET' && url.pathname === '/api/activity') {
    const buckets = new Map()
    for (const e of employees.values()) {
      for (const s of e.tools?.['Claude Code']?.sessions || []) {
        if (!s.endedAt) continue
        const day = s.endedAt.slice(0, 10)
        const b = buckets.get(day) || { date: day, tokens: 0, cost: 0, sessions: 0 }
        b.tokens += (s.tokensIn || 0) + (s.tokensOut || 0); b.cost += s.costUSD || 0; b.sessions++
        buckets.set(day, b)
      }
    }
    const rows = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
      .map((r) => ({ date: r.date.slice(5), tokens: Number((r.tokens / 1e6).toFixed(2)), cost: Number(r.cost.toFixed(2)), sessions: r.sessions }))
    return json(res, 200, rows)
  }

  // POST /api/gemma  { task:'remediate'|'compress'|'explain', input } -> LOCAL Gemma text (graceful fallback)
  if (req.method === 'POST' && url.pathname === '/api/gemma') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      let p
      try { p = JSON.parse(body || '{}') } catch { return json(res, 400, { error: 'bad json' }) }
      const task = p.task || 'explain'
      const input = String(p.input || '').slice(0, 6000)
      const specs = {
        remediate: { system: "You are an in-house AI-governance assistant. Given a finding about a developer's AI-tool usage, reply with 2-3 short, concrete remediation steps. No preamble.", prompt: `Finding: ${input}\n\nRemediation steps:` },
        compress: { system: 'You compress CLAUDE.md instruction files. Keep every operative rule; cut redundancy and filler. Return only the rewrite.', prompt: input },
        explain: { system: 'You are an in-house AI-governance assistant. Explain this finding to a CISO in two plain sentences.', prompt: input },
        evaluate: { system: "You are a CISO's in-house AI-governance analyst. In three or four sentences, assess this employee's agentic-AI usage using ONLY the facts in the snapshot. Do not invent names, roles, companies, products, or tools that are not stated. Say whether their governance risk is low, elevated, or high and why, name the single most important concern grounded in the actual numbers and findings, and give the top optimization or fix. Map the top concern to EU AI Act, ISO 42001, or NIST AI RMF. No preamble, no lists, plain sentences.", prompt: input },
        compliance_control: { system: "You are a CISO's in-house AI-governance analyst. Given ONE compliance control and the evidence from an org's agentic-AI usage, write a 2 to 3 sentence narrative: the current standing against this control, the specific gap (or state plainly that it is satisfied and why), and the single most important action. Ground every claim in the evidence provided. No preamble, do not restate the control text, do not use bullet points.", prompt: input },
        compliance_summary: { system: "You are a CISO's in-house AI-governance analyst. Write a 3 to 4 sentence executive summary of the org's overall AI-governance posture for a CISO, citing the biggest risk and the strongest control from the evidence. Plain, decisive, board-ready. No preamble, no bullets.", prompt: input },
        compliance_digest: { system: "You are a CISO's in-house AI-governance analyst. Write a short compliance digest for this reporting period: what changed, any new or resolved risks, and the trend. If this is the first period with no prior baseline, say a baseline has been established and summarise the current posture in 3 to 4 sentences. No preamble.", prompt: input },
        compliance_qa: { system: "You are a CISO's in-house AI-governance analyst answering a question about the org's AI-governance posture. Answer using ONLY the evidence provided, and cite the specific numbers or findings that support your answer. If the evidence does not cover the question, say so plainly rather than guessing. Two to four sentences. No preamble.", prompt: input },
      }
      const spec = specs[task] || specs.explain
      try {
        const ac = new AbortController()
        const to = setTimeout(() => ac.abort(), Number(process.env.OPSES_GEMMA_TIMEOUT || 60000))
        const r = await fetch(`${GEMMA_URL}/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: spec.system, prompt: spec.prompt, max_new_tokens: p.max || 220 }), signal: ac.signal })
        clearTimeout(to)
        if (!r.ok) throw new Error(`gemma ${r.status}`)
        const d = await r.json()
        return json(res, 200, { text: d.text, source: 'gemma', model: d.model })
      } catch (e) {
        const fb = {
          remediate: 'Rotate the exposed secret, purge it from prompt history, and add a pre-send secret scanner to the endpoint agent.',
          compress: input.slice(0, 400) + (input.length > 400 ? ' ...' : ''),
          explain: "Sensitive data or a risky agentic-AI configuration was detected in this developer's usage and should be reviewed against policy.",
          evaluate: 'Risk: Elevated\nConcerns:\n- Prompts may carry secrets or customer data to cloud models; confirm masking is enforced at the endpoint.\n- MCP and CLAUDE.md context load inflates token spend on every session.\nOptimizations:\n- Prune unused MCP servers and compress CLAUDE.md to cut startup context.\n- Route routine work to a cheaper model tier to lower spend.\nCompliance: Data-exposure risk maps to EU AI Act Art. 10 (data governance); review before sign-off.',
          compliance_control: 'Continuous, masked capture of every agent session provides standing evidence for this control. Where findings are open, close the highest-severity item first and re-scan to confirm the gap is resolved.',
          compliance_summary: 'The org has continuous, in-house visibility into every coding-agent session, which itself satisfies the logging and monitoring controls. The main residual risk is sensitive context reaching cloud models; enforcing endpoint masking and pruning unused MCP servers would lift the posture toward the target.',
          compliance_digest: 'Baseline established for this reporting period. Continuous session capture is active across all connected editors, secrets are masked on-device before leaving the machine, and open findings are tracked against EU AI Act, ISO 42001, and NIST AI RMF controls. Watch data-exposure findings as the leading indicator next period.',
          compliance_qa: 'Based on the captured evidence, the org maintains continuous in-house logging of agent usage and masks secrets on-device. Review the open findings register for the specific controls with gaps before sign-off.',
        }
        return json(res, 200, { text: fb[task] || fb.explain, source: 'fallback', note: 'local Gemma not running', error: String(e.message || e) })
      }
    })
    return
  }

  // GET /api/sessions  (flat, lightweight session list across all employees, newest first)
  if (req.method === 'GET' && url.pathname === '/api/sessions') {
    const out = []
    for (const e of employees.values()) {
      for (const s of e.tools?.['Claude Code']?.sessions || []) {
        out.push({
          id: s.id, dev: e.id, devName: e.name, tool: 'Claude Code',
          project: s.project, startedAt: s.startedAt, endedAt: s.endedAt,
          messages: s.messages, tokensIn: s.tokensIn, tokensOut: s.tokensOut,
          costUSD: s.costUSD, models: s.models, hasLeak: (s.leaks || []).length > 0,
        })
      }
    }
    out.sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))
    return json(res, 200, out)
  }

  // GET /api/analytics  (hourly heatmap, model + project + editor
  // distribution, token economy, daily activity, coding streak, monthly spend)
  if (req.method === 'GET' && url.pathname === '/api/analytics') {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: 0, messages: 0 }))
    const models = new Map()
    const projects = new Map()
    const editors = new Map()
    const daily = new Map()   // 'YYYY-MM-DD' -> { date, sessions, tokens, cost }
    const byMonth = new Map() // 'YYYY-MM'    -> { month, sessions, tokens, cost }
    const days = new Set()
    let input = 0, cacheRead = 0, output = 0
    for (const e of employees.values()) {
      for (const [editor, tool] of Object.entries(e.tools || {})) {
        for (const s of tool?.sessions || []) {
          const tok = (s.tokensIn || 0) + (s.tokensOut || 0)
          const when = s.endedAt || s.startedAt
          if (when) {
            const h = new Date(when).getHours()
            if (hours[h]) { hours[h].sessions++; hours[h].messages += s.messages || 0 }
            const day = String(when).slice(0, 10)
            days.add(day)
            const dd = daily.get(day) || { date: day, sessions: 0, tokens: 0, cost: 0 }
            dd.sessions++; dd.tokens += tok; dd.cost += s.costUSD || 0; daily.set(day, dd)
            const mon = day.slice(0, 7)
            const mm = byMonth.get(mon) || { month: mon, sessions: 0, tokens: 0, cost: 0 }
            mm.sessions++; mm.tokens += tok; mm.cost += s.costUSD || 0; byMonth.set(mon, mm)
          }
          input += s.tokensIn || 0; cacheRead += s.cacheRead || 0; output += s.tokensOut || 0
          const primary = (s.models && s.models[0]) || 'unknown'
          const m = models.get(primary) || { model: primary, sessions: 0, tokens: 0, cost: 0 }
          m.sessions++; m.tokens += tok; m.cost += s.costUSD || 0; models.set(primary, m)
          const p = projects.get(s.project) || { project: s.project, sessions: 0, tokens: 0, cost: 0 }
          p.sessions++; p.tokens += tok; p.cost += s.costUSD || 0; projects.set(s.project, p)
          const ed = editors.get(editor) || { editor, sessions: 0, messages: 0, tokensIn: 0, tokensOut: 0, cost: 0 }
          ed.sessions++; ed.messages += s.messages || 0; ed.tokensIn += s.tokensIn || 0; ed.tokensOut += s.tokensOut || 0; ed.cost += s.costUSD || 0
          editors.set(editor, ed)
        }
      }
    }
    const round = (x) => Number((x || 0).toFixed(2))
    const busiest = hours.reduce((a, b) => (b.sessions > a.sessions ? b : a), hours[0])
    const dailyArr = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, cost: round(d.cost) }))
    return json(res, 200, {
      hours,
      models: [...models.values()].sort((a, b) => b.tokens - a.tokens).map((m) => ({ ...m, cost: round(m.cost) })),
      projects: [...projects.values()].sort((a, b) => b.tokens - a.tokens).map((p) => ({ ...p, cost: round(p.cost) })),
      editors: [...editors.values()].sort((a, b) => (b.tokensIn + b.tokensOut) - (a.tokensIn + a.tokensOut)).map((e) => ({ ...e, cost: round(e.cost) })),
      daily: dailyArr,
      byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, cost: round(m.cost) })),
      streak: streakOf(dailyArr.map((d) => d.date)),
      tokenEconomy: { input, cacheRead, output },
      busiestHour: busiest.hour,
      activeDays: days.size,
    })
  }

  // GET /api/subscriptions  (editor plans, quotas, credits, rate limits)
  if (req.method === 'GET' && url.pathname === '/api/subscriptions') return json(res, 200, SUBSCRIPTIONS)

  // GET /api/connections  (supported-editor capability matrix)
  if (req.method === 'GET' && url.pathname === '/api/connections') return json(res, 200, CONNECTIONS)

  // GET /api/relay  (MCP session-context sharing state)
  if (req.method === 'GET' && url.pathname === '/api/relay') return json(res, 200, RELAY)

  // GET /api/mcps  (org-wide MCP server registry, aggregated from captured configs)
  if (req.method === 'GET' && url.pathname === '/api/mcps') {
    // Policy allowlist of reviewed/approved MCP servers. Anything else is surfaced
    // as "unreviewed" - the shadow-MCP attack surface a CISO wants flagged.
    const APPROVED = new Set(['filesystem', 'git', 'github', 'memory', 'fetch', 'time', 'sequential-thinking', 'playwright', 'postgres', 'sqlite', 'context7', 'sentry', 'puppeteer', 'brave-search', 'slack'])
    const servers = new Map()
    let configured = 0, seatsWithMcp = 0
    for (const e of employees.values()) {
      const list = e.config?.mcpServers || []
      if (list.length) seatsWithMcp++
      configured += list.length
      for (const raw of list) {
        const key = String(raw).toLowerCase()
        const s = servers.get(key) || { name: raw, usedBy: new Set() }
        s.usedBy.add(e.name || e.id)
        servers.set(key, s)
      }
    }
    const rows = [...servers.entries()].map(([key, s]) => ({
      name: s.name,
      seats: s.usedBy.size,
      usedBy: [...s.usedBy],
      status: APPROVED.has(key) ? 'approved' : 'unreviewed',
    })).sort((a, b) => (a.status === b.status ? b.seats - a.seats : a.status === 'unreviewed' ? -1 : 1))
    return json(res, 200, {
      servers: rows,
      summary: {
        unique: rows.length,
        configured,
        seats: employees.size,
        seatsWithMcp,
        approved: rows.filter((r) => r.status === 'approved').length,
        unreviewed: rows.filter((r) => r.status === 'unreviewed').length,
      },
    })
  }

  // GET /api/context-files  (org inventory of agent-instruction context loaded every session)
  if (req.method === 'GET' && url.pathname === '/api/context-files') {
    const files = []
    const hookCounts = new Map()
    let totalTokens = 0
    for (const e of employees.values()) {
      const cfg = e.config || {}
      const tok = cfg.claudeMdTokens || 0
      if (tok > 0) {
        totalTokens += tok
        files.push({ seat: e.name || e.id, os: e.os || '', file: 'CLAUDE.md', scope: 'user', tokens: tok, status: tok > 2000 ? 'bloated' : 'ok' })
      }
      for (const h of cfg.hooks || []) hookCounts.set(h, (hookCounts.get(h) || 0) + 1)
    }
    files.sort((a, b) => b.tokens - a.tokens)
    const hooks = [...hookCounts.entries()].map(([name, seats]) => ({ name, seats })).sort((a, b) => b.seats - a.seats)
    return json(res, 200, {
      files,
      hooks,
      summary: {
        files: files.length,
        totalTokens,
        bloated: files.filter((f) => f.status === 'bloated').length,
        hooks: hooks.length,
        seats: employees.size,
      },
    })
  }

  // GET /api/posture  (per-project governance posture grade from findings + config)
  if (req.method === 'GET' && url.pathname === '/api/posture') {
    const projects = new Map()
    for (const e of employees.values()) {
      const cfg = e.config || {}
      const shadow = (cfg.mcpServers || []).filter((m) => !APPROVED_MCP.has(String(m).toLowerCase()))
      const bloat = (cfg.claudeMdTokens || 0) > 2000
      for (const tool of Object.values(e.tools || {})) {
        for (const s of tool?.sessions || []) {
          const p = projects.get(s.project) || { project: s.project, seats: new Set(), sessions: 0, leaks: 0, shadow: 0, bloat: false }
          p.seats.add(e.name || e.id); p.sessions++
          p.leaks += (s.leaks || []).length
          p.shadow = Math.max(p.shadow, shadow.length)
          if (bloat) p.bloat = true
          projects.set(s.project, p)
        }
      }
    }
    const rows = [...projects.values()].map((p) => {
      const checks = [
        { name: 'Secret exposure', pass: p.leaks === 0, detail: p.leaks ? `${p.leaks} prompt(s) sent secrets to a cloud model` : 'No secrets detected in prompts' },
        { name: 'MCP scope', pass: p.shadow === 0, detail: p.shadow ? `${p.shadow} unreviewed MCP server(s) in reach of this repo` : 'All MCP servers in scope are approved' },
        { name: 'Context hygiene', pass: !p.bloat, detail: p.bloat ? 'A contributor loads a bloated CLAUDE.md every session' : 'Context files within budget' },
      ]
      const passed = checks.filter((c) => c.pass).length
      const score = Math.round((passed / checks.length) * 100)
      const grade = score >= 100 ? 'A' : score >= 67 ? 'B' : score >= 34 ? 'D' : 'F'
      return { project: p.project, seats: p.seats.size, contributors: [...p.seats], sessions: p.sessions, score, grade, checks }
    }).sort((a, b) => a.score - b.score || b.sessions - a.sessions)
    return json(res, 200, {
      projects: rows,
      summary: {
        projects: rows.length,
        atRisk: rows.filter((r) => r.score < 67).length,
        avgScore: rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0,
      },
    })
  }

  // GET/PUT /api/policy  (data controls - retention, masking rules, scoped-out projects)
  if (req.method === 'GET' && url.pathname === '/api/policy') return json(res, 200, loadPolicy())
  if (req.method === 'PUT' && url.pathname === '/api/policy') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let p
      try { p = JSON.parse(body || '{}') } catch { return json(res, 400, { error: 'bad json' }) }
      const cur = loadPolicy()
      const next = { ...cur, ...p, masking: { ...cur.masking, ...(p.masking || {}) } }
      savePolicy(next)
      broadcast({ type: 'policy', at: new Date().toISOString() })
      return json(res, 200, next)
    })
    return
  }

  // GET /api/tools  (tool-call usage across all sessions, for the drill-down)
  if (req.method === 'GET' && url.pathname === '/api/tools') {
    const tools = new Map()
    for (const e of employees.values()) {
      for (const tool of Object.values(e.tools || {})) {
        for (const s of tool?.sessions || []) {
          for (const tc of s.toolCalls || []) {
            const t = tools.get(tc.name) || { name: tc.name, count: 0, sessions: new Set(), seats: new Set(), samples: [] }
            t.count++; t.sessions.add(s.id); t.seats.add(e.name || e.id)
            if (t.samples.length < 14) t.samples.push({ seat: e.name || e.id, project: s.project, arg: tc.arg, ts: tc.ts })
            tools.set(tc.name, t)
          }
        }
      }
    }
    const rows = [...tools.values()].map((t) => ({ name: t.name, count: t.count, sessions: t.sessions.size, seats: t.seats.size, samples: t.samples })).sort((a, b) => b.count - a.count)
    return json(res, 200, { tools: rows, summary: { unique: rows.length, total: rows.reduce((s, t) => s + t.count, 0) } })
  }

  // POST /api/query  (scoped, parameterized read-only query over telemetry for auditors)
  if (req.method === 'POST' && url.pathname === '/api/query') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let q
      try { q = JSON.parse(body || '{}') } catch { return json(res, 400, { error: 'bad json' }) }
      const source = q.source === 'findings' ? 'findings' : q.source === 'tools' ? 'tools' : 'sessions'
      const limit = Math.min(Number(q.limit) || 200, 1000)
      let rows = []
      if (source === 'sessions') {
        for (const e of employees.values()) for (const [tool, t] of Object.entries(e.tools || {})) for (const s of t?.sessions || [])
          rows.push({ id: String(s.id).slice(0, 8), seat: e.name || e.id, tool, project: s.project, model: (s.models || [])[0] || '', messages: s.messages, tokensIn: s.tokensIn, tokensOut: s.tokensOut, costUSD: s.costUSD, leaks: (s.leaks || []).length, endedAt: s.endedAt })
      } else if (source === 'findings') {
        for (const e of employees.values()) for (const f of e.findings || [])
          rows.push({ id: String(f.id).slice(0, 12), seat: e.name || e.id, kind: f.kind, severity: f.severity, title: f.title, control: f.control, detectedAt: f.detectedAt })
      } else {
        for (const e of employees.values()) for (const tool of Object.values(e.tools || {})) for (const s of tool?.sessions || []) for (const tc of s.toolCalls || [])
          rows.push({ tool: tc.name, seat: e.name || e.id, project: s.project, arg: tc.arg, ts: tc.ts })
      }
      const cols = { sessions: ['id', 'seat', 'tool', 'project', 'model', 'messages', 'tokensIn', 'tokensOut', 'costUSD', 'leaks', 'endedAt'], findings: ['id', 'seat', 'kind', 'severity', 'title', 'control', 'detectedAt'], tools: ['tool', 'seat', 'project', 'arg', 'ts'] }
      for (const flt of q.filters || []) {
        if (!flt || !flt.field) continue
        const { field, op, value } = flt
        rows = rows.filter((r) => {
          const v = r[field]
          if (v == null) return false
          if (op === 'contains') return String(v).toLowerCase().includes(String(value).toLowerCase())
          if (op === 'gt') return Number(v) > Number(value)
          if (op === 'lt') return Number(v) < Number(value)
          return String(v).toLowerCase() === String(value).toLowerCase()
        })
      }
      const count = rows.length
      return json(res, 200, { source, columns: cols[source], rows: rows.slice(0, limit), count })
    })
    return
  }

  // GET /api/project?name=  (single-project drill-down: sessions, contributors, MCP, posture)
  if (req.method === 'GET' && url.pathname === '/api/project') {
    const name = url.searchParams.get('name')
    if (!name) return json(res, 400, { error: 'name required' })
    const sessions = [], contributors = new Set(), models = new Map(), mcp = new Set()
    let tokensIn = 0, tokensOut = 0, cost = 0, leaks = 0, bloat = false
    for (const e of employees.values()) {
      let contributes = false
      for (const [tool, t] of Object.entries(e.tools || {})) for (const s of t?.sessions || []) if (s.project === name) {
        contributes = true
        sessions.push({ id: s.id, seat: e.name || e.id, tool, model: (s.models || [])[0] || '', messages: s.messages, tokensIn: s.tokensIn, tokensOut: s.tokensOut, costUSD: s.costUSD, leaks: (s.leaks || []).length, endedAt: s.endedAt })
        tokensIn += s.tokensIn || 0; tokensOut += s.tokensOut || 0; cost += s.costUSD || 0; leaks += (s.leaks || []).length
        for (const m of s.models || []) models.set(m, (models.get(m) || 0) + 1)
      }
      if (contributes) {
        contributors.add(e.name || e.id)
        for (const m of e.config?.mcpServers || []) mcp.add(m)
        if ((e.config?.claudeMdTokens || 0) > 2000) bloat = true
      }
    }
    if (!sessions.length) return json(res, 404, { error: 'no such project' })
    sessions.sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))
    const shadow = [...mcp].filter((m) => !APPROVED_MCP.has(String(m).toLowerCase()))
    return json(res, 200, {
      project: name, contributors: [...contributors], sessions,
      totals: { sessions: sessions.length, tokensIn, tokensOut, costUSD: Number(cost.toFixed(2)), leaks },
      models: [...models.entries()].map(([model, n]) => ({ model, sessions: n })).sort((a, b) => b.sessions - a.sessions),
      mcp: { all: [...mcp], shadow }, contextBloat: bloat,
    })
  }

  // GET /api/findings  (all findings across employees, newest first)
  if (req.method === 'GET' && url.pathname === '/api/findings') {
    const all = [...employees.values()].flatMap((e) => (e.findings || []).map((f) => ({ ...f, devName: e.name })))
    all.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]) || String(b.detectedAt).localeCompare(String(a.detectedAt)))
    return json(res, 200, all)
  }

  if (url.pathname === '/') return json(res, 200, { service: 'opses-server', employees: employees.size, endpoints: ['/api/org', '/api/activity', '/api/findings', '/api/employees', '/api/employees/:id', '/ingest/:id (POST)', '/api/stream (SSE)'] })
  json(res, 404, { error: 'not found' })
})

load()
server.listen(PORT, () => console.log(`OPSES server: in-house, listening on http://localhost:${PORT}  (data dir: ${DATA_DIR})`))
