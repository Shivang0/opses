#!/usr/bin/env node
// OPSES capture agent - runs on an employee machine.
// Reads local Claude Code transcripts (+ best-effort Cursor), normalizes usage,
// masks secrets/PII locally, and POSTs to the in-house OPSES server.
// Zero external deps (Node >= 20). Historical sync + real-time watch.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { costUSD } from './pricing.mjs'

const EMPLOYEE_ID = process.env.OPSES_EMPLOYEE_ID || process.argv[2]
const EMPLOYEE_NAME = process.env.OPSES_NAME || EMPLOYEE_ID
const SERVER = (process.env.OPSES_SERVER || 'http://localhost:4319').replace(/\/$/, '')
const WATCH = process.argv.includes('--watch') || process.env.OPSES_WATCH === '1'
const INTERVAL = Number(process.env.OPSES_INTERVAL || 15000)

if (!EMPLOYEE_ID) {
  console.error('OPSES: missing employee id. Usage: OPSES_EMPLOYEE_ID=shivang node opses-agent.mjs [--watch]')
  process.exit(1)
}

const HOME = os.homedir()
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects')

// ---------- privacy: mask before anything leaves the machine ----------
const SECRET_PATTERNS = [
  [/sk-[a-zA-Z0-9-_]{10,}/g, 'sk-****', 'api_key'],
  [/(?:AKIA|ASIA)[A-Z0-9]{12,}/g, 'AWS-****', 'aws_key'],
  [/ghp_[A-Za-z0-9]{20,}/g, 'ghp-****', 'github_token'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/g, 'xox-****', 'slack_token'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '<JWT>', 'jwt'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '<SSN>', 'ssn'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<EMAIL>', 'email'],
  [/\b(?:\d[ -]*?){13,16}\b/g, '<CARD>', 'card'],
]
// Only high-precision patterns are flagged as findings (email/card are masked but too noisy to flag).
const FLAG_SKIP = new Set(['email', 'card'])
function detectSecrets(text = '') {
  const kinds = []
  for (const [re, , kind] of SECRET_PATTERNS) {
    re.lastIndex = 0
    if (!FLAG_SKIP.has(kind) && re.test(text)) kinds.push(kind)
  }
  return kinds
}
function mask(text = '') {
  let out = String(text)
  for (const [re, repl] of SECRET_PATTERNS) out = out.replace(re, repl)
  return out
}

// ---------- helpers ----------
function extractText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c?.text || c?.content || (c?.type ? `[${c.type}]` : '')))
      .join(' ')
  }
  return ''
}
function projectName(cwd, file) {
  if (cwd) return path.basename(cwd)
  const dir = path.basename(path.dirname(file)) // encoded slug
  return dir.replace(/^C--/, '').replace(/-/g, '/')
}
function walk(dir) {
  const out = []
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

// ---------- parse a single Claude Code session transcript ----------
function parseSession(file) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch { return null }
  const objs = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try { objs.push(JSON.parse(line)) } catch {}
  }
  if (!objs.length) return null

  let sessionId = null, cwd = null, version = null, gitBranch = null, first = null, last = null
  let tokensIn = 0, cacheRead = 0, tokensOut = 0, cost = 0, prompts = 0, responses = 0, realPrompts = 0
  const modelCounts = new Map(), events = [], leaks = [], toolCalls = []
  // Short, masked summary of a tool call's target - the file / command / query it
  // acted on, never the full content. Governance sees the ACTION, not the payload.
  const toolArg = (input) => {
    if (!input || typeof input !== 'object') return ''
    const pick = input.file_path || input.path || input.command || input.pattern || input.url || input.query || input.notebook_path
    if (pick) return mask(String(pick)).slice(0, 80)
    return Object.keys(input).slice(0, 3).join(', ')
  }

  for (const o of objs) {
    sessionId ||= o.sessionId
    cwd ||= o.cwd
    version ||= o.version
    gitBranch ||= o.gitBranch
    const ts = o.timestamp ? Date.parse(o.timestamp) : null
    if (ts) { first = first == null ? ts : Math.min(first, ts); last = last == null ? ts : Math.max(last, ts) }

    if (o.type === 'user' && !o.isMeta) {
      prompts++
      if (!o.isSidechain) realPrompts++ // human turns only (subagent turns are sidechains)
      const text = extractText(o.message?.content)
      const found = detectSecrets(text)
      if (found.length) leaks.push({ ts: o.timestamp, kinds: found })
      if (events.length < 50) events.push({ role: 'user', ts: o.timestamp, textPreview: mask(text).slice(0, 280) })
    } else if (o.type === 'assistant') {
      responses++
      const u = o.message?.usage || {}
      // headline tokensIn = real new input (prompt + cache writes), EXCLUDING cache reads
      // (cache reads re-count the same context every turn and would balloon the totals).
      const newIn = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0)
      const cr = u.cache_read_input_tokens || 0
      const outp = u.output_tokens || 0
      tokensIn += newIn; cacheRead += cr; tokensOut += outp
      const model = o.message?.model || 'unknown'
      // '<synthetic>' is Claude Code's own injected (non-inference) messages, not a
      // real model - keep it out of the session's model list so the real model leads.
      if (model !== '<synthetic>') modelCounts.set(model, (modelCounts.get(model) || 0) + 1)
      // bill fresh input at 1x, cache writes at 1.25x, cache reads at 0.1x, output at 1x
      cost += costUSD(model, {
        input: u.input_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0,
        cacheRead: cr,
        output: outp,
      })
      if (events.length < 50)
        events.push({ role: 'assistant', ts: o.timestamp, model, out: outp, textPreview: mask(extractText(o.message?.content)).slice(0, 280) })
      const content = o.message?.content
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === 'tool_use' && b.name && toolCalls.length < 120) {
            toolCalls.push({ name: b.name, arg: toolArg(b.input), ts: o.timestamp })
          }
        }
      }
    }
  }

  sessionId ||= path.basename(file, '.jsonl')
  return {
    id: sessionId, tool: 'Claude Code', project: projectName(cwd, file), cwd, gitBranch, version,
    startedAt: first ? new Date(first).toISOString() : null,
    endedAt: last ? new Date(last).toISOString() : null,
    prompts, responses, realPrompts, messages: prompts + responses,
    tokensIn, cacheRead, tokensOut, costUSD: Number(cost.toFixed(4)),
    models: [...modelCounts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m), leaks, events, toolCalls,
  }
}

// ---------- config manifest (MCP servers, CLAUDE.md) for hygiene findings ----------
function readConfig() {
  const manifest = { mcpServers: [], claudeMdTokens: 0, hooks: [] }
  for (const f of [path.join(HOME, '.claude.json'), path.join(HOME, '.claude', 'settings.json')]) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'))
      const servers = j.mcpServers || (j.projects && Object.values(j.projects).flatMap((p) => Object.keys(p.mcpServers || {})))
      if (servers) manifest.mcpServers.push(...(Array.isArray(servers) ? servers : Object.keys(servers)))
      if (j.hooks) manifest.hooks.push(...Object.keys(j.hooks))
    } catch {}
  }
  try {
    const md = fs.readFileSync(path.join(HOME, '.claude', 'CLAUDE.md'), 'utf8')
    manifest.claudeMdTokens = Math.round(md.length / 4)
  } catch {}
  manifest.mcpServers = [...new Set(manifest.mcpServers)]
  return manifest
}

// ---------- best-effort Cursor detection ----------
function detectCursor() {
  const candidates = [
    path.join(HOME, '.cursor'),
    path.join(HOME, 'AppData', 'Roaming', 'Cursor'),
    path.join(HOME, 'Library', 'Application Support', 'Cursor'),
    path.join(HOME, '.config', 'Cursor'),
  ]
  const found = candidates.find((p) => fs.existsSync(p))
  if (!found)
    return { installed: false, sessions: [], totals: emptyTotals(), note: 'Cursor not detected on this machine.' }
  return {
    installed: true, sessions: [], totals: emptyTotals(),
    note: 'Cursor detected. Install cursor-otel-hook (LangGuard-AI/cursor-otel-hook) to stream prompts/tokens/MCP calls to OPSES.',
  }
}

function emptyTotals() {
  return { sessions: 0, messages: 0, tokensIn: 0, tokensOut: 0, costUSD: 0, byModel: {} }
}
function totalsFrom(sessions) {
  const t = emptyTotals()
  for (const s of sessions) {
    t.sessions++; t.messages += s.messages; t.tokensIn += s.tokensIn; t.tokensOut += s.tokensOut; t.costUSD += s.costUSD
    for (const m of s.models) t.byModel[m] = (t.byModel[m] || 0) + 1
  }
  t.costUSD = Number(t.costUSD.toFixed(2))
  return t
}

// ---------- scan + build payload ----------
function scanClaude() {
  // Skip background-agent instances (e.g. the claude-mem observer spins up its own
  // Claude Code on Sonnet to watch the main session). Those are tooling, not the
  // developer's coding, and would otherwise inflate model / token / cost usage and
  // surface as the "latest session".
  const EXCLUDE = /claude-mem/i
  const files = walk(CLAUDE_PROJECTS)
  const bySession = new Map()
  for (const f of files) {
    // agent-*.jsonl are Task-tool subagent transcripts (fully sidechain), not sessions.
    if (EXCLUDE.test(f) || path.basename(f).startsWith('agent-')) continue
    const s = parseSession(f)
    if (!s || s.messages === 0) continue
    if (s.cwd && EXCLUDE.test(s.cwd)) continue
    // Real conversations have back-and-forth; drop single-turn queue-operation stubs
    // and any sidechain-only transcript (< 2 human prompts).
    if ((s.realPrompts || 0) < 2) continue
    const prev = bySession.get(s.id)
    if (!prev || s.events.length > prev.events.length) bySession.set(s.id, s)
  }
  return [...bySession.values()].sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''))
}

function buildPayload() {
  const claudeSessions = scanClaude()
  const cursor = detectCursor()
  const manifest = readConfig()
  return {
    id: EMPLOYEE_ID,
    name: EMPLOYEE_NAME,
    host: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    config: manifest,
    tools: {
      'Claude Code': { installed: claudeSessions.length > 0, sessions: claudeSessions, totals: totalsFrom(claudeSessions) },
      Cursor: cursor,
    },
    updatedAt: new Date().toISOString(),
  }
}

// one-shot reachability check before the first sync - catches a mistyped or
// unreachable OPSES_SERVER (e.g. a stale tunnel URL) with a clear message
// instead of a confusing hang or a bare fetch error.
async function checkConnectivity() {
  try {
    await fetch(`${SERVER}/`, { signal: AbortSignal.timeout(5000) })
    console.log(`OPSES: server reachable at ${SERVER}`)
    return true
  } catch (e) {
    console.error(`OPSES: cannot reach server at ${SERVER} (${e.message}). Check OPSES_SERVER (and that any tunnel is up) and try again.`)
    return false
  }
}

async function push(payload) {
  const url = `${SERVER}/ingest/${encodeURIComponent(EMPLOYEE_ID)}`
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const cc = payload.tools['Claude Code'].totals
    console.log(`OPSES: synced ${EMPLOYEE_ID} -> ${SERVER}  (Claude Code: ${cc.sessions} sessions, ${(cc.tokensIn + cc.tokensOut).toLocaleString()} tokens, $${cc.costUSD})`)
  } catch (e) {
    console.error(`OPSES: failed to reach server at ${SERVER} (${e.message}). Is the CISO server running?`)
  }
}

async function main() {
  await checkConnectivity()
  await push(buildPayload())
  if (WATCH) {
    console.log(`OPSES: watching for real-time updates every ${INTERVAL / 1000}s (Ctrl+C to stop)...`)
    setInterval(() => push(buildPayload()), INTERVAL)
  }
}
main()
