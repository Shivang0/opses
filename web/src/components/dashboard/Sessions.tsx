import { useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { SlideOver } from './SlideOver'
import TokenTimeline from './TokenTimeline'
import SessionTranscript from './SessionTranscript'
import { fmtDateTime, formatDateShort, shortModel } from './meta'
import { formatCompact, formatUSD } from '../../lib/utils'
import { useEmployeeDetail } from '../../lib/useOpses'
import { useFetch } from '../../lib/useFetch'
import { getSessions, type ApiSessionRow } from '../../lib/api'

// ---------------------------------------------------------------------------
// Small model chip (matches the developer drill-down styling).
// ---------------------------------------------------------------------------
function ModelChips({ models }: { models: string[] }) {
  if (!models || models.length === 0) return <span className="text-subtle">-</span>
  return (
    <span className="flex flex-wrap gap-1">
      {models.map((m) => (
        <span
          key={m}
          className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-subtle"
        >
          {shortModel(m)}
        </span>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Slide-over body: session totals + the live event trail for the row.
// The trail is fetched per developer and matched to this session by id.
// ---------------------------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-paper">{value}</dd>
    </div>
  )
}

function SessionDetail({ row }: { row: ApiSessionRow }) {
  const { status, detail } = useEmployeeDetail(row.dev)
  const session = detail?.tools?.['Claude Code']?.sessions?.find((s) => s.id === row.id)
  const events = session?.events ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{row.tool}</Badge>
        <ModelChips models={row.models} />
        {row.hasLeak && (
          <Badge variant="high">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Leak
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Metric label="Messages" value={String(row.messages)} />
        <Metric label="Tokens in" value={formatCompact(row.tokensIn)} />
        <Metric label="Tokens out" value={formatCompact(row.tokensOut)} />
        <Metric label="Cost" value={formatUSD(row.costUSD)} />
      </dl>

      <p className="font-mono text-xs text-subtle">
        {fmtDateTime(row.startedAt)} - {fmtDateTime(row.endedAt)}
      </p>

      {status === 'live' && <TokenTimeline events={events} />}

      <div>
        <h3 className="mono-eyebrow mb-3">Transcript</h3>

        {status === 'loading' && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading transcript...
          </div>
        )}

        {status === 'unavailable' && (
          <div className="rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
            The transcript streams from the in-house server and is unavailable right now. Session
            totals are shown above.
          </div>
        )}

        {status === 'live' && <SessionTranscript events={events} toolCalls={session?.toolCalls} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar: case-insensitive search + optional model filter.
// ---------------------------------------------------------------------------
function Toolbar({
  query,
  onQuery,
  model,
  onModel,
  models,
  onRefresh,
  refreshing,
}: {
  query: string
  onQuery: (v: string) => void
  model: string
  onModel: (v: string) => void
  models: string[]
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <>
      <div className="relative w-full sm:w-56">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search project or developer"
          aria-label="Search sessions by project or developer"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-paper placeholder:text-subtle focus-visible:border-accent"
        />
      </div>
      <div className="relative">
        <label htmlFor="session-model-filter" className="sr-only">
          Filter sessions by model
        </label>
        <select
          id="session-model-filter"
          value={model}
          onChange={(e) => onModel(e.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-paper focus-visible:border-accent"
        >
          <option value="all">All models</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {shortModel(m)}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
      </div>
      <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
        Refresh
      </Button>
    </>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Sessions() {
  const { status, data, refetch } = useFetch(getSessions)
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('all')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sessions = useMemo(() => data ?? [], [data])

  // Distinct models across all sessions, for the filter dropdown.
  const modelOptions = useMemo(
    () => Array.from(new Set(sessions.flatMap((s) => s.models))).filter(Boolean).sort(),
    [sessions],
  )

  // Newest first, then apply search + model filter.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...sessions]
      .sort((a, b) => (b.endedAt || b.startedAt || '').localeCompare(a.endedAt || a.startedAt || ''))
      .filter((s) => {
        const matchesQuery =
          !q || s.project.toLowerCase().includes(q) || s.devName.toLowerCase().includes(q)
        const matchesModel = model === 'all' || s.models.includes(model)
        return matchesQuery && matchesModel
      })
  }, [sessions, query, model])

  const active = activeId ? (sessions.find((s) => s.id === activeId) ?? null) : null
  // Retain the last opened session so content stays visible while the panel slides out.
  const shownRef = useRef<ApiSessionRow | null>(null)
  if (active) shownRef.current = active
  const shown = shownRef.current

  const toolbar = (
    <Toolbar
      query={query}
      onQuery={setQuery}
      model={model}
      onModel={setModel}
      models={modelOptions}
      onRefresh={refetch}
      refreshing={status === 'loading'}
    />
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Sessions"
        subtitle="Every agent session, searchable, with its full event trail."
        actions={toolbar}
      />

      {status === 'loading' && !data ? (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading sessions...
        </div>
      ) : !data ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Sessions are unavailable right now. The in-house server could not be reached.
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Developer</TH>
                <TH>Tool</TH>
                <TH>Models</TH>
                <TH className="text-right">Messages</TH>
                <TH className="text-right">Tokens</TH>
                <TH className="text-right">Cost</TH>
                <TH className="text-right">Ended</TH>
                <TH>Leak</TH>
                <TH>
                  <span className="sr-only">Open detail</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <TR>
                  <TD colSpan={10} className="py-10 text-center text-muted">
                    No sessions match your search.
                  </TD>
                </TR>
              ) : (
                rows.map((s) => (
                  <TR
                    key={s.id}
                    data-state={activeId === s.id ? 'selected' : undefined}
                    onClick={() => setActiveId(s.id)}
                    className="cursor-pointer"
                  >
                    <TD>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveId(s.id)
                        }}
                        aria-haspopup="dialog"
                        className="rounded text-left font-medium text-paper transition-colors hover:text-accent"
                      >
                        {s.project}
                      </button>
                    </TD>
                    <TD className="whitespace-nowrap text-paper">{s.devName}</TD>
                    <TD className="whitespace-nowrap">
                      <Badge variant="neutral">{s.tool}</Badge>
                    </TD>
                    <TD className="max-w-[12rem]">
                      <ModelChips models={s.models} />
                    </TD>
                    <TD className="text-right font-mono tabular-nums text-paper">{s.messages}</TD>
                    <TD className="text-right">
                      <span className="block font-mono tabular-nums text-paper">
                        {formatCompact(s.tokensIn + s.tokensOut)}
                      </span>
                      <span className="block font-mono text-[11px] tabular-nums text-subtle">
                        {formatCompact(s.tokensIn)} in · {formatCompact(s.tokensOut)} out
                      </span>
                    </TD>
                    <TD className="text-right font-mono tabular-nums text-paper">
                      {formatUSD(s.costUSD)}
                    </TD>
                    <TD className="whitespace-nowrap text-right text-muted">
                      {formatDateShort(s.endedAt)}
                    </TD>
                    <TD>
                      {s.hasLeak && (
                        <Badge variant="high">
                          <AlertTriangle className="size-3" aria-hidden="true" />
                          Leak
                        </Badge>
                      )}
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
            Showing {rows.length} of {sessions.length} sessions
          </div>
        </Card>
      )}

      <SlideOver
        open={active !== null}
        onClose={() => setActiveId(null)}
        eyebrow={<Eyebrow>Session</Eyebrow>}
        title={shown?.project ?? ''}
        footer={
          shown ? (
            <div className="flex items-center justify-between gap-3 font-mono text-xs text-subtle">
              <span className="truncate">{shown.id}</span>
              <span className="shrink-0">{shown.devName}</span>
            </div>
          ) : undefined
        }
      >
        {shown && <SessionDetail key={shown.id} row={shown} />}
      </SlideOver>
    </div>
  )
}
