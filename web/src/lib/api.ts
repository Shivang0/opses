// OPSES live API client - talks to the in-house server. All types mirror the
// server payloads exactly; the view-model mapping lives in ./useOpses.
// Base URL is overridable at build time via VITE_OPSES_API.
export const API = import.meta.env.VITE_OPSES_API ?? 'http://localhost:4319'

// ---------------------------------------------------------------------------
// Raw server payload shapes (GET /api/*)
// ---------------------------------------------------------------------------
export interface ApiToolSplit {
  name: string
  value: number
}

export interface ApiOrg {
  activeDevs: number
  openFindings: number
  bySeverity: { high: number; medium: number; low: number }
  costMTD: number
  tokensMTD: number
  complianceScore: number
  toolSplit: ApiToolSplit[]
}

export interface ApiActivityPoint {
  date: string // "MM-DD"
  tokens: number // millions
  cost: number // USD
  sessions?: number
}

export interface ApiFinding {
  id: string
  dev: string
  devName?: string
  kind: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
  evidence: string
  control: string
  citation: string
  detectedAt: string
  savingsUSDPerDay?: number
}

export interface ApiEmployee {
  id: string
  name: string
  host: string
  os: string
  updatedAt: string
  tools: string[]
  sessions: number
  tokens: number
  costUSD: number
  mcpCount: number
  openFindings: number
  highFindings: number
  riskScore: number
}

export interface ApiEvent {
  role: 'user' | 'assistant'
  ts: string
  model?: string
  out?: number
  textPreview?: string
}

export interface ApiLeak {
  ts: string
  kinds: string[]
}

export interface ApiSession {
  id: string
  project: string
  cwd: string
  gitBranch?: string
  version?: string
  startedAt: string
  endedAt: string
  prompts: number
  responses: number
  messages: number
  tokensIn: number
  cacheRead?: number
  tokensOut: number
  costUSD: number
  models: string[]
  leaks: ApiLeak[]
  events: ApiEvent[]
  toolCalls?: ApiSessionToolCall[]
}

export interface ApiSessionToolCall {
  name: string
  arg: string
  ts: string
}

export interface ApiToolTotals {
  sessions: number
  messages: number
  tokensIn: number
  tokensOut: number
  costUSD: number
  byModel: Record<string, number>
}

export interface ApiTool {
  installed: boolean
  note?: string
  totals?: ApiToolTotals
  sessions?: ApiSession[]
}

export interface ApiEmployeeDetail {
  id: string
  name: string
  host: string
  os: string
  updatedAt: string
  config: { mcpServers: string[]; claudeMdTokens: number; hooks: string[] }
  tools: Record<string, ApiTool>
  findings: ApiFinding[]
}

// Analytics roll-up (GET /api/analytics) - org-wide usage aggregates.
export interface ApiAnalyticsHour {
  hour: number // 0-23
  sessions: number
  messages: number
}
export interface ApiAnalyticsModel {
  model: string
  sessions: number
  tokens: number
  cost: number
}
export interface ApiAnalyticsProject {
  project: string
  sessions: number
  tokens: number
  cost: number
}
export interface ApiTokenEconomy {
  input: number
  cacheRead: number
  output: number
}
export interface ApiAnalyticsEditor {
  editor: string
  sessions: number
  messages: number
  tokensIn: number
  tokensOut: number
  cost: number
}
export interface ApiAnalyticsDay {
  date: string // 'YYYY-MM-DD'
  sessions: number
  tokens: number
  cost: number
}
export interface ApiAnalyticsMonth {
  month: string // 'YYYY-MM'
  sessions: number
  tokens: number
  cost: number
}
export interface ApiStreak {
  current: number
  longest: number
}
export interface ApiAnalytics {
  hours: ApiAnalyticsHour[]
  models: ApiAnalyticsModel[]
  projects: ApiAnalyticsProject[]
  editors: ApiAnalyticsEditor[]
  daily: ApiAnalyticsDay[]
  byMonth: ApiAnalyticsMonth[]
  streak: ApiStreak
  tokenEconomy: ApiTokenEconomy
  busiestHour: number
  activeDays: number
}

// Editor subscription plans + quotas (GET /api/subscriptions).
export interface ApiSubscription {
  editor: string
  plan: string
  status: 'active' | 'trial' | 'inactive'
  used: number
  limit: number
  unit: string
  renews: string
  rateLimit: string
  note: string
}

// Supported-editor capability matrix (GET /api/connections). Each capability is
// 'yes' | 'no' | 'warn'.
export type ApiCapability = 'yes' | 'no' | 'warn'
export interface ApiConnectionRow {
  editor: string
  msgs: ApiCapability
  tools: ApiCapability
  models: ApiCapability
  tokens: ApiCapability
}
export interface ApiConnections {
  note: string
  editors: ApiConnectionRow[]
}

// MCP relay state (GET /api/relay) - share masked session context across a team.
export interface ApiRelayContext {
  id: string
  name: string
  project: string
  sessions: number
  tokens: number
  sharedBy: string
  updatedAt: string
  members: string[]
}
export interface ApiRelayMember {
  id: string
  name: string
  role: string
  contexts: number
}
export interface ApiRelay {
  status: string
  server: string
  endpoint: string
  protocol: string
  sharedContexts: ApiRelayContext[]
  members: ApiRelayMember[]
}

// Flat session list (GET /api/sessions) - one row per assistant session. The
// full event trail is fetched per developer via getEmployee(dev).
export interface ApiSessionRow {
  id: string
  dev: string
  devName: string
  tool: string
  project: string
  startedAt: string
  endedAt: string
  messages: number
  tokensIn: number
  tokensOut: number
  costUSD: number
  models: string[]
  hasLeak: boolean
}

// ---------------------------------------------------------------------------
// Fetch helper - aborts quickly so an unreachable server falls back fast.
// ---------------------------------------------------------------------------
async function get<T>(path: string, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API}${path}`, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export const getOrg = () => get<ApiOrg>('/api/org')
export const getActivity = () => get<ApiActivityPoint[]>('/api/activity')
export const getFindings = () => get<ApiFinding[]>('/api/findings')
export const getEmployees = () => get<ApiEmployee[]>('/api/employees')
export const getEmployee = (id: string) =>
  get<ApiEmployeeDetail>(`/api/employees/${encodeURIComponent(id)}`)
export const getAnalytics = () => get<ApiAnalytics>('/api/analytics')
export const getSessions = () => get<ApiSessionRow[]>('/api/sessions')
export const getSubscriptions = () => get<ApiSubscription[]>('/api/subscriptions')
export const getConnections = () => get<ApiConnections>('/api/connections')
export const getRelay = () => get<ApiRelay>('/api/relay')

// MCP registry (GET /api/mcps) - org-wide inventory of configured MCP servers,
// with a policy allowlist splitting approved from unreviewed (shadow) servers.
export interface ApiMcpServer {
  name: string
  seats: number
  usedBy: string[]
  status: 'approved' | 'unreviewed'
}
export interface ApiMcps {
  servers: ApiMcpServer[]
  summary: {
    unique: number
    configured: number
    seats: number
    seatsWithMcp: number
    approved: number
    unreviewed: number
  }
}
export const getMcps = () => get<ApiMcps>('/api/mcps')

// Context-file inventory (GET /api/context-files) - agent-instruction files loaded
// on every session, their token weight, and the hooks configured across seats.
export interface ApiContextFile {
  seat: string
  os: string
  file: string
  scope: string
  tokens: number
  status: 'ok' | 'bloated'
}
export interface ApiContextHook {
  name: string
  seats: number
}
export interface ApiContextFiles {
  files: ApiContextFile[]
  hooks: ApiContextHook[]
  summary: { files: number; totalTokens: number; bloated: number; hooks: number; seats: number }
}
export const getContextFiles = () => get<ApiContextFiles>('/api/context-files')

// Governance posture (GET /api/posture) - per-project agent-safety grade.
export interface ApiPostureCheck {
  name: string
  pass: boolean
  detail: string
}
export interface ApiPostureProject {
  project: string
  seats: number
  contributors: string[]
  sessions: number
  score: number
  grade: 'A' | 'B' | 'D' | 'F'
  checks: ApiPostureCheck[]
}
export interface ApiPosture {
  projects: ApiPostureProject[]
  summary: { projects: number; atRisk: number; avgScore: number }
}
export const getPosture = () => get<ApiPosture>('/api/posture')

// Data-control policy (GET/PUT /api/policy) - retention, masking rules, scoping.
export interface ApiPolicy {
  retentionDays: number
  masking: { secrets: boolean; apiKeys: boolean; pii: boolean; emails: boolean }
  scopedOut: string[]
}
export const getPolicy = () => get<ApiPolicy>('/api/policy')
export async function savePolicy(patch: Partial<ApiPolicy>): Promise<ApiPolicy> {
  const res = await fetch(`${API}/api/policy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`policy -> HTTP ${res.status}`)
  return (await res.json()) as ApiPolicy
}

// Tool-call usage (GET /api/tools) - powers the Deep Analysis tool drill-down.
export interface ApiToolSample {
  seat: string
  project: string
  arg: string
  ts: string
}
export interface ApiToolRow {
  name: string
  count: number
  sessions: number
  seats: number
  samples: ApiToolSample[]
}
export interface ApiTools {
  tools: ApiToolRow[]
  summary: { unique: number; total: number }
}
export const getTools = () => get<ApiTools>('/api/tools')

// Evidence Query (POST /api/query) - scoped, parameterized read-only query.
export type QuerySource = 'sessions' | 'findings' | 'tools'
export interface QueryFilter {
  field: string
  op: 'eq' | 'contains' | 'gt' | 'lt'
  value: string
}
export interface ApiQueryResult {
  source: QuerySource
  columns: string[]
  rows: Record<string, string | number>[]
  count: number
}
export async function runQuery(source: QuerySource, filters: QueryFilter[], limit = 200): Promise<ApiQueryResult> {
  const res = await fetch(`${API}/api/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source, filters, limit }),
  })
  if (!res.ok) throw new Error(`query -> HTTP ${res.status}`)
  return (await res.json()) as ApiQueryResult
}

// Project detail (GET /api/project?name=) - single-repo drill-down.
export interface ApiProjectSession {
  id: string
  seat: string
  tool: string
  model: string
  messages: number
  tokensIn: number
  tokensOut: number
  costUSD: number
  leaks: number
  endedAt: string
}
export interface ApiProjectDetail {
  project: string
  contributors: string[]
  sessions: ApiProjectSession[]
  totals: { sessions: number; tokensIn: number; tokensOut: number; costUSD: number; leaks: number }
  models: { model: string; sessions: number }[]
  mcp: { all: string[]; shadow: string[] }
  contextBloat: boolean
}
export const getProject = (name: string) => get<ApiProjectDetail>(`/api/project?name=${encodeURIComponent(name)}`)

// ---------------------------------------------------------------------------
// Local Gemma remediation - POST /api/gemma. The server proxies to the on-device
// Gemma model and returns { source: 'gemma' } when it answered, or a templated
// { source: 'fallback' } when Gemma isn't running. Never leaves the building.
// ---------------------------------------------------------------------------
export interface GemmaResult {
  text: string
  source: 'gemma' | 'fallback'
  model?: string
  note?: string
}

// Low-level on-device model call. task selects the server-side system prompt;
// input is the fully-built prompt. Every compliance/remediation feature funnels
// through here so they all share one graceful-fallback path.
export async function runGemma(task: string, input: string): Promise<GemmaResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 90000) // local CPU inference can be slow
  try {
    const res = await fetch(`${API}/api/gemma`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task, input }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`gemma -> HTTP ${res.status}`)
    return (await res.json()) as GemmaResult
  } finally {
    clearTimeout(timer)
  }
}

export function remediate(
  f: Pick<ApiFinding, 'title' | 'detail' | 'evidence' | 'control' | 'citation'>,
): Promise<GemmaResult> {
  return runGemma(
    'remediate',
    `${f.title} - ${f.detail} Evidence: ${f.evidence}. Control: ${f.control} (${f.citation}).`,
  )
}

// Roll one employee's full captured usage into a compact prompt so the CISO can
// evaluate the whole picture (not just one finding) with the on-device model.
export function summarizeEmployee(d: ApiEmployeeDetail): string {
  const cc = d.tools?.['Claude Code']
  const t = cc?.totals
  const sessions = t?.sessions ?? cc?.sessions?.length ?? 0
  const tokens = t ? t.tokensIn + t.tokensOut : 0
  const cost = t?.costUSD ?? 0
  const models = t ? Object.keys(t.byModel).join(', ') : ''
  const mcp = d.config?.mcpServers?.length ?? 0
  const cmd = d.config?.claudeMdTokens ?? 0
  const hooks = d.config?.hooks?.length ?? 0
  const findings = d.findings ?? []
  const high = findings.filter((f) => f.severity === 'high').length
  const flist = findings.slice(0, 6).map((f) => `${f.severity}: ${f.title}`).join('; ')
  return [
    `Employee ${d.name} on ${d.os}.`,
    `Claude Code: ${sessions} sessions, ${tokens.toLocaleString()} tokens, $${cost} estimated spend, models: ${models || 'n/a'}.`,
    `Config: ${mcp} MCP servers, CLAUDE.md ~${cmd} tokens, ${hooks} hooks.`,
    `Findings: ${findings.length} open (${high} high). ${flist}`,
  ].join(' ')
}

export function evaluateEmployee(d: ApiEmployeeDetail): Promise<GemmaResult> {
  return runGemma('evaluate', summarizeEmployee(d))
}

// ---------------------------------------------------------------------------
// Live updates - Server-Sent Events. Calls onUpdate() on every 'update' frame.
// Returns an unsubscribe function. onError fires if the stream can't be reached.
// ---------------------------------------------------------------------------
export function subscribeUpdates(onUpdate: () => void, onError?: () => void): () => void {
  let es: EventSource | null = null
  try {
    es = new EventSource(`${API}/api/stream`)
  } catch {
    onError?.()
    return () => {}
  }
  es.onmessage = (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data) as { type?: string }
      if (msg?.type === 'update') onUpdate()
    } catch {
      /* ignore malformed frames */
    }
  }
  es.onerror = () => {
    onError?.()
  }
  return () => {
    es?.close()
  }
}
