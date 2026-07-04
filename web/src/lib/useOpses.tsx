// OPSES data layer — one context that fetches the live in-house API, maps it to
// the view-model the dashboard renders, and gracefully falls back to the bundled
// sample dataset when the server is unreachable so the demo always renders.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getActivity,
  getEmployee,
  getEmployees,
  getFindings,
  getOrg,
  subscribeUpdates,
  type ApiActivityPoint,
  type ApiEmployee,
  type ApiEmployeeDetail,
  type ApiFinding,
  type ApiOrg,
} from './api'
import {
  activity as sampleActivity,
  controls as sampleControls,
  developers as sampleDevs,
  findings as sampleFindings,
  org as sampleOrg,
  toolSplit as sampleToolSplit,
  type FindingKind,
  type Severity,
} from '../data/sample'
import type { ControlStatus } from '../components/dashboard/meta'

// ---------------------------------------------------------------------------
// View-model — the normalized shapes the components consume, from either source.
// ---------------------------------------------------------------------------
export interface OrgView {
  activeDevs: number
  openFindings: number
  bySeverity: { high: number; medium: number; low: number }
  costMTD: number
  tokensMTD: number
  complianceScore: number
}

export interface ViewFinding {
  id: string
  dev: string
  devName: string
  kind: FindingKind
  severity: Severity
  title: string
  detail: string
  evidence: string
  control: string
  citation: string
  detectedAt: string
  savingsUSDPerDay?: number
}

export interface DevRow {
  id: string
  name: string
  sublabel: string
  tools: string[]
  sessions: number
  tokens: number
  costUSD: number
  mcpCount: number
  riskScore: number
  openFindings: number
  highFindings: number
}

export interface ControlView {
  id: string
  label: string
  status: ControlStatus
  findings: number
}

export interface ToolSplitDatum {
  name: string
  value: number
}

export interface ActivityDatum {
  date: string
  tokens: number
  cost: number
  sessions?: number
}

export type ConnStatus = 'loading' | 'live' | 'sample'

interface OpsesView {
  org: OrgView
  activity: ActivityDatum[]
  findings: ViewFinding[]
  developers: DevRow[]
  controls: ControlView[]
  toolSplit: ToolSplitDatum[]
}

export interface OpsesData extends OpsesView {
  status: ConnStatus
  refetch: () => void
}

// ---------------------------------------------------------------------------
// Mappers — API payload -> view-model.
// ---------------------------------------------------------------------------
function orgViewFromApi(o: ApiOrg): OrgView {
  return {
    activeDevs: o.activeDevs,
    openFindings: o.openFindings,
    bySeverity: o.bySeverity,
    costMTD: o.costMTD,
    tokensMTD: o.tokensMTD,
    complianceScore: o.complianceScore,
  }
}

function findingViewFromApi(f: ApiFinding): ViewFinding {
  return {
    id: f.id,
    dev: f.dev,
    devName: f.devName ?? f.dev,
    kind: f.kind as FindingKind,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    evidence: f.evidence,
    control: f.control,
    citation: f.citation,
    detectedAt: f.detectedAt,
    savingsUSDPerDay: f.savingsUSDPerDay,
  }
}

function osLabel(os: string): string {
  if (/win/i.test(os)) return 'Windows'
  if (/darwin|mac/i.test(os)) return 'macOS'
  if (/linux/i.test(os)) return 'Linux'
  return os.split(' ')[0] || os
}

function devRowFromApi(e: ApiEmployee): DevRow {
  return {
    id: e.id,
    name: e.name,
    sublabel: e.host && e.host !== e.name ? e.host : osLabel(e.os),
    tools: e.tools.length ? e.tools : ['Claude Code'],
    sessions: e.sessions,
    tokens: e.tokens,
    costUSD: e.costUSD,
    mcpCount: e.mcpCount,
    riskScore: e.riskScore,
    openFindings: e.openFindings,
    highFindings: e.highFindings,
  }
}

function activityFromApi(a: ApiActivityPoint): ActivityDatum {
  return { date: a.date, tokens: a.tokens, cost: a.cost, sessions: a.sessions }
}

// Compliance controls aren't served directly — derive them from live findings by
// mapping each finding's `control` string onto a stable framework catalog.
const CONTROL_CATALOG: { id: string; label: string; match: (control: string) => boolean }[] = [
  { id: 'EU AI Act Art. 10', label: 'Data governance & management', match: (c) => c.startsWith('EU AI Act') },
  { id: 'ISO/IEC 42001 A.10', label: 'Third-party & supply-chain', match: (c) => c.startsWith('ISO/IEC 42001') },
  {
    id: 'NIST AI RMF MAP 3.4',
    label: 'Inventory & resource use',
    match: (c) => c.startsWith('NIST AI RMF') && !c.includes('GOVERN'),
  },
  { id: 'NIST AI RMF GOVERN 1.1', label: 'Policies & accountability', match: () => false },
]

function controlsFromFindings(findings: ViewFinding[]): ControlView[] {
  return CONTROL_CATALOG.map((cat) => {
    const matched = findings.filter((f) => cat.match(f.control))
    const status: ControlStatus = matched.some((f) => f.severity === 'high')
      ? 'at_risk'
      : matched.length > 0
        ? 'monitored'
        : 'ok'
    return { id: cat.id, label: cat.label, status, findings: matched.length }
  })
}

// ---------------------------------------------------------------------------
// Sample fallback — build the same view-model from the bundled dataset.
// ---------------------------------------------------------------------------
function buildSampleView(): OpsesView {
  const nameById = new Map(sampleDevs.map((d) => [d.id, d.name]))
  const findings: ViewFinding[] = sampleFindings.map((f) => ({
    ...f,
    devName: nameById.get(f.dev) ?? f.dev,
  }))
  const developers: DevRow[] = sampleDevs.map((d) => {
    const devF = sampleFindings.filter((f) => f.dev === d.id)
    return {
      id: d.id,
      name: d.name,
      sublabel: d.role,
      tools: [d.tool],
      sessions: d.sessions,
      tokens: d.tokensIn + d.tokensOut,
      costUSD: d.costUSD,
      mcpCount: d.mcpCount,
      riskScore: d.riskScore,
      openFindings: devF.length,
      highFindings: devF.filter((f) => f.severity === 'high').length,
    }
  })
  return {
    org: { ...sampleOrg },
    activity: sampleActivity.map((a) => ({ date: a.date, tokens: a.tokens, cost: a.cost })),
    findings,
    developers,
    controls: sampleControls.map((c) => ({
      id: c.id,
      label: c.label,
      status: c.status,
      findings: c.findings,
    })),
    toolSplit: sampleToolSplit.map((t) => ({ name: t.name, value: t.value })),
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
const OpsesContext = createContext<OpsesData | null>(null)

export function OpsesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: ConnStatus; view: OpsesView }>(() => ({
    status: 'loading',
    view: buildSampleView(),
  }))

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const [org, activity, findings, employees] = await Promise.all([
        getOrg(),
        getActivity(),
        getFindings(),
        getEmployees(),
      ])
      const mapped = findings.map(findingViewFromApi)
      setState({
        status: 'live',
        view: {
          org: orgViewFromApi(org),
          activity: activity.map(activityFromApi),
          findings: mapped,
          developers: employees.map(devRowFromApi),
          controls: controlsFromFindings(mapped),
          toolSplit: org.toolSplit.map((t) => ({ name: t.name, value: t.value })),
        },
      })
      return true
    } catch {
      // Keep live data on a transient refetch failure; only fall back if we never
      // reached the server (initial load).
      setState((s) => (s.status === 'live' ? s : { status: 'sample', view: buildSampleView() }))
      return false
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsub: (() => void) | undefined
    void load().then((ok) => {
      if (!active) return
      if (ok) unsub = subscribeUpdates(() => void load())
    })
    return () => {
      active = false
      unsub?.()
    }
  }, [load])

  const value = useMemo<OpsesData>(
    () => ({ status: state.status, ...state.view, refetch: () => void load() }),
    [state, load],
  )

  return <OpsesContext.Provider value={value}>{children}</OpsesContext.Provider>
}

export function useOpses(): OpsesData {
  const ctx = useContext(OpsesContext)
  if (!ctx) throw new Error('useOpses must be used within <OpsesProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// On-demand employee detail (drill-down) — fetched when a developer is opened.
// ---------------------------------------------------------------------------
export type DetailStatus = 'idle' | 'loading' | 'live' | 'unavailable'

export function useEmployeeDetail(id: string | null): {
  status: DetailStatus
  detail: ApiEmployeeDetail | null
} {
  const [state, setState] = useState<{ status: DetailStatus; detail: ApiEmployeeDetail | null }>({
    status: 'idle',
    detail: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ status: 'idle', detail: null })
      return
    }
    let cancelled = false
    setState({ status: 'loading', detail: null })
    getEmployee(id)
      .then((d) => {
        if (!cancelled) setState({ status: 'live', detail: d })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable', detail: null })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return state
}
