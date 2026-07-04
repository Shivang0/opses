import { useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CircleDollarSign,
  Flame,
  FolderGit2,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  Eyebrow,
  PageHeader,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { SlideOver } from './SlideOver'
import { fmtDateTime, shortModel } from './meta'
import { formatCompact, formatUSD } from '../../lib/utils'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, getSessions, type ApiSessionRow } from '../../lib/api'

// ---------------------------------------------------------------------------
// Projects - per-project analytics with a drill-down detail panel. The project
// roster, sessions, tokens, and cost come from the analytics roll-up; the flat
// session list enriches each project with its message count, model + editor
// mix, and the per-session rows shown in the slide-over.
// ---------------------------------------------------------------------------
interface Split {
  name: string
  value: number
}
interface ProjectView {
  project: string
  sessions: number // authoritative, from the analytics roll-up
  tokens: number // authoritative, from the analytics roll-up
  cost: number // authoritative, from the analytics roll-up
  messages: number // derived from the flat session list
  models: string[] // distinct short model ids, sorted
  editors: Split[] // sessions per editor, desc
  modelSplit: Split[] // sessions per model, desc
  rows: ApiSessionRow[] // this project's sessions, newest first
}

/** Distinct short model ids for a session's raw model list. */
function distinctShort(models: string[]): string[] {
  return Array.from(new Set(models.map(shortModel)))
}

// ---------------------------------------------------------------------------
// Model chips - distinct short model ids, capped so a busy project stays tidy.
// ---------------------------------------------------------------------------
const MAX_CHIPS = 3
function ModelChips({ models }: { models: string[] }) {
  if (models.length === 0) return <span className="text-subtle">-</span>
  const shown = models.slice(0, MAX_CHIPS)
  const extra = models.length - shown.length
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((m) => (
        <span
          key={m}
          className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-subtle"
        >
          {m}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-subtle">
          +{extra}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Labeled proportion bars - reused for the editor mix and the model mix in the
// drill-down. The bar is decorative; the label + count carry the value.
// ---------------------------------------------------------------------------
function SplitBars({ title, rows }: { title: string; rows: Split[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return (
    <div>
      <h3 className="mono-eyebrow mb-3">{title}</h3>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const pct = max > 0 ? Math.max(4, (r.value / max) * 100) : 0
          return (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-xs text-paper">{r.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-subtle">{r.value}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide-over body: project totals, the editor + model mix, and every session
// that ran under the project.
// ---------------------------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-paper">{value}</dd>
    </div>
  )
}

function ProjectDetail({ project, sessionsReady }: { project: ProjectView; sessionsReady: boolean }) {
  const hasSessions = project.rows.length > 0
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Metric label="Sessions" value={String(project.sessions)} />
        <Metric label="Messages" value={sessionsReady ? formatCompact(project.messages) : '-'} />
        <Metric label="Tokens" value={formatCompact(project.tokens)} />
        <Metric label="Cost" value={formatUSD(project.cost)} />
      </dl>

      {hasSessions && (project.editors.length > 0 || project.modelSplit.length > 0) && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {project.editors.length > 0 && <SplitBars title="Editors" rows={project.editors} />}
          {project.modelSplit.length > 0 && <SplitBars title="Models" rows={project.modelSplit} />}
        </div>
      )}

      <div>
        <h3 className="mono-eyebrow mb-3">
          Sessions
          {hasSessions && (
            <span className="ml-1.5 normal-case tracking-normal text-subtle">
              {project.rows.length}
            </span>
          )}
        </h3>

        {!hasSessions ? (
          <p className="rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
            {sessionsReady
              ? 'No individual sessions were captured for this project.'
              : 'Per-session detail streams from the in-house server and is unavailable right now.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <Table>
              <THead>
                <TR>
                  <TH>Developer</TH>
                  <TH>Models</TH>
                  <TH className="text-right">Messages</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Ended</TH>
                  <TH>Leak</TH>
                </TR>
              </THead>
              <TBody>
                {project.rows.map((s) => (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap text-paper">{s.devName}</TD>
                    <TD>
                      <ModelChips models={distinctShort(s.models)} />
                    </TD>
                    <TD className="text-right font-mono tabular-nums text-paper">{s.messages}</TD>
                    <TD className="text-right font-mono tabular-nums text-paper">
                      {formatCompact(s.tokensIn + s.tokensOut)}
                    </TD>
                    <TD className="text-right font-mono tabular-nums text-paper">
                      {formatUSD(s.costUSD)}
                    </TD>
                    <TD className="whitespace-nowrap text-right text-muted">
                      {fmtDateTime(s.endedAt)}
                    </TD>
                    <TD>
                      {s.hasLeak && (
                        <Badge variant="high">
                          <AlertTriangle className="size-3" aria-hidden="true" />
                          Leak
                        </Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Projects() {
  const { status, data: analytics, refetch: refetchAnalytics } = useFetch(getAnalytics)
  const { data: sessions, refetch: refetchSessions } = useFetch(getSessions)
  const [query, setQuery] = useState('')
  const [activeName, setActiveName] = useState<string | null>(null)

  // The analytics roll-up drives the loading/error gating; the session list is
  // a best-effort enrichment, so refresh pulls both.
  const refresh = () => {
    refetchAnalytics()
    refetchSessions()
  }

  const sessionRows = useMemo(() => sessions ?? [], [sessions])
  const sessionsReady = sessions !== null

  // Fold the flat session list into per-project enrichment (message totals, the
  // editor + model mix, and the drill-down rows).
  const enrichment = useMemo(() => {
    const map = new Map<
      string,
      {
        messages: number
        models: Set<string>
        editors: Map<string, number>
        modelSplit: Map<string, number>
        rows: ApiSessionRow[]
      }
    >()
    for (const s of sessionRows) {
      let e = map.get(s.project)
      if (!e) {
        e = { messages: 0, models: new Set(), editors: new Map(), modelSplit: new Map(), rows: [] }
        map.set(s.project, e)
      }
      e.messages += s.messages
      e.rows.push(s)
      e.editors.set(s.tool, (e.editors.get(s.tool) ?? 0) + 1)
      for (const short of distinctShort(s.models)) {
        e.models.add(short)
        e.modelSplit.set(short, (e.modelSplit.get(short) ?? 0) + 1)
      }
    }
    return map
  }, [sessionRows])

  // Join the authoritative analytics roster with the session enrichment.
  const projects = useMemo<ProjectView[]>(() => {
    const toSplit = (m: Map<string, number>): Split[] =>
      Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    return (analytics?.projects ?? []).map((p) => {
      const e = enrichment.get(p.project)
      return {
        project: p.project,
        sessions: p.sessions,
        tokens: p.tokens,
        cost: p.cost,
        messages: e?.messages ?? 0,
        models: e ? Array.from(e.models).sort() : [],
        editors: e ? toSplit(e.editors) : [],
        modelSplit: e ? toSplit(e.modelSplit) : [],
        rows: e
          ? [...e.rows].sort((a, b) =>
              (b.endedAt || b.startedAt || '').localeCompare(a.endedAt || a.startedAt || ''),
            )
          : [],
      }
    })
  }, [analytics, enrichment])

  // Sort by tokens desc, then apply the case-insensitive name search.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...projects]
      .sort((a, b) => b.tokens - a.tokens)
      .filter((p) => !q || p.project.toLowerCase().includes(q))
  }, [projects, query])

  // Headline metrics span every project, not just the filtered view.
  const totalProjects = projects.length
  const totalSessions = projects.reduce((sum, p) => sum + p.sessions, 0)
  const busiest = projects.reduce<ProjectView | null>(
    (top, p) => (!top || p.sessions > top.sessions ? p : top),
    null,
  )
  const priciest = projects.reduce<ProjectView | null>(
    (top, p) => (!top || p.cost > top.cost ? p : top),
    null,
  )

  const active = activeName ? (projects.find((p) => p.project === activeName) ?? null) : null
  // Retain the last opened project so content persists while the panel slides out.
  const shownRef = useRef<ProjectView | null>(null)
  if (active) shownRef.current = active
  const shown = shownRef.current

  const actions = (
    <>
      <div className="relative w-full sm:w-56">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          aria-label="Search projects by name"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-paper placeholder:text-subtle focus-visible:border-accent"
        />
      </div>
      <Button variant="secondary" size="sm" onClick={refresh} disabled={status === 'loading'}>
        <RefreshCw
          className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'}
          aria-hidden="true"
        />
        Refresh
      </Button>
    </>
  )

  // First load, nothing to show yet.
  if (status === 'loading' && !analytics) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Projects"
          subtitle="Per-project analytics across every agent session."
        />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading projects...
        </div>
      </div>
    )
  }

  // Never reached the server.
  if (!analytics) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Projects"
          subtitle="Per-project analytics across every agent session."
          actions={
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Projects are unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Projects"
        subtitle="Per-project analytics across every agent session."
        actions={actions}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total projects"
          value={totalProjects}
          icon={<FolderGit2 />}
          hint={`${totalSessions} session${totalSessions === 1 ? '' : 's'} tracked`}
        />
        <Stat
          label="Busiest project"
          value={busiest ? busiest.project : '-'}
          icon={<Flame />}
          hint={busiest ? `${busiest.sessions} session${busiest.sessions === 1 ? '' : 's'}` : undefined}
        />
        <Stat
          label="Most expensive"
          value={priciest ? priciest.project : '-'}
          icon={<CircleDollarSign />}
          hint={priciest ? formatUSD(priciest.cost) : undefined}
        />
        <Stat
          label="Total sessions"
          value={totalSessions}
          icon={<Activity />}
          hint={`across ${totalProjects} project${totalProjects === 1 ? '' : 's'}`}
        />
      </div>

      {/* Projects table */}
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Project</TH>
              <TH className="text-right">Sessions</TH>
              <TH className="text-right">Messages</TH>
              <TH className="text-right">Tokens</TH>
              <TH className="text-right">Cost</TH>
              <TH>Models</TH>
              <TH>
                <span className="sr-only">Open detail</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-10 text-center text-muted">
                  {projects.length === 0
                    ? 'No project activity recorded yet.'
                    : 'No projects match your search.'}
                </TD>
              </TR>
            ) : (
              visible.map((p) => (
                <TR
                  key={p.project}
                  data-state={activeName === p.project ? 'selected' : undefined}
                  onClick={() => setActiveName(p.project)}
                  className="cursor-pointer"
                >
                  <TD>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveName(p.project)
                      }}
                      aria-haspopup="dialog"
                      className="rounded text-left font-medium text-paper transition-colors hover:text-accent"
                    >
                      {p.project}
                    </button>
                  </TD>
                  <TD className="text-right font-mono tabular-nums text-paper">{p.sessions}</TD>
                  <TD className="text-right font-mono tabular-nums text-paper">
                    {sessionsReady ? formatCompact(p.messages) : <span className="text-subtle">-</span>}
                  </TD>
                  <TD className="text-right font-mono tabular-nums text-paper">
                    {formatCompact(p.tokens)}
                  </TD>
                  <TD className="text-right font-mono tabular-nums text-paper">{formatUSD(p.cost)}</TD>
                  <TD className="max-w-[14rem]">
                    <ModelChips models={p.models} />
                  </TD>
                  <TD className="text-right">
                    <ChevronRight aria-hidden="true" className="inline size-4 text-subtle" />
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        <div className="border-t border-line px-3 py-2.5 font-mono text-xs text-subtle">
          Showing {visible.length} of {projects.length} project{projects.length === 1 ? '' : 's'}
        </div>
      </Card>

      <SlideOver
        open={active !== null}
        onClose={() => setActiveName(null)}
        eyebrow={<Eyebrow>Project</Eyebrow>}
        title={shown?.project ?? ''}
        footer={
          shown ? (
            <div className="flex items-center justify-between gap-3">
              <Link
                to={`/dashboard/projects/detail?name=${encodeURIComponent(shown.project)}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Full governance report
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <span className="shrink-0 font-mono text-xs text-subtle">{formatUSD(shown.cost)}</span>
            </div>
          ) : undefined
        }
      >
        {shown && <ProjectDetail key={shown.project} project={shown} sessionsReady={sessionsReady} />}
      </SlideOver>
    </div>
  )
}
