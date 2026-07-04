#!/usr/bin/env node
// OPSES in-house server — runs on the CISO machine only.
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
      control: 'NIST AI RMF', citation: 'MAP 3.4 — inventory & resource use',
      detectedAt: e.updatedAt, savingsUSDPerDay: Number((mcpCount * 0.12).toFixed(1)),
    })
  } else if (mcpCount > 8) {
    findings.push({
      id: `${e.id}-mcp`, dev: e.id, kind: 'mcp_bloat', severity: 'low',
      title: `${mcpCount} MCP servers configured`, detail: 'Minor context cleanup available.',
      evidence: `${mcpCount} MCP servers configured`, control: 'NIST AI RMF', citation: 'MAP 3.4 — inventory & resource use',
      detectedAt: e.updatedAt, savingsUSDPerDay: 0.6,
    })
  }
  if ((cfg.claudeMdTokens || 0) > 2000) {
    findings.push({
      id: `${e.id}-md`, dev: e.id, kind: 'claudemd_bloat', severity: 'low',
      title: `CLAUDE.md is ~${cfg.claudeMdTokens} tokens`, detail: 'A trimmed rewrite can preserve the operative rules at a fraction of the size.',
      evidence: `~${cfg.claudeMdTokens} tokens loaded every session`, control: 'NIST AI RMF', citation: 'MAP 3.4 — resource efficiency',
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
          compress: input.slice(0, 400) + (input.length > 400 ? ' …' : ''),
          explain: "Sensitive data or a risky agentic-AI configuration was detected in this developer's usage and should be reviewed against policy.",
        }
        return json(res, 200, { text: fb[task] || fb.explain, source: 'fallback', note: 'local Gemma not running', error: String(e.message || e) })
      }
    })
    return
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
