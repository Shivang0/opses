// OPSES live API client — talks to the in-house server. All types mirror the
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

// ---------------------------------------------------------------------------
// Fetch helper — aborts quickly so an unreachable server falls back fast.
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

// ---------------------------------------------------------------------------
// Live updates — Server-Sent Events. Calls onUpdate() on every 'update' frame.
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
