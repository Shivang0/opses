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
    return json(res, 200, {
      activeDevs: list.length,
      openFindings: findings.length,
      bySeverity: { high: findings.filter((f) => f.severity === 'high').length, medium: findings.filter((f) => f.severity === 'medium').length, low: findings.filter((f) => f.severity === 'low').length },
      costMTD: Number(costMTD.toFixed(2)), tokensMTD,
      complianceScore: Math.max(0, 100 - findings.reduce((s, f) => s + ({ high: 12, medium: 5, low: 2 }[f.severity] || 0), 0)),
    })
  }

  if (url.pathname === '/') return json(res, 200, { service: 'opses-server', employees: employees.size, endpoints: ['/api/org', '/api/employees', '/api/employees/:id', '/ingest/:id (POST)', '/api/stream (SSE)'] })
  json(res, 404, { error: 'not found' })
})

load()
server.listen(PORT, () => console.log(`OPSES server: in-house, listening on http://localhost:${PORT}  (data dir: ${DATA_DIR})`))
