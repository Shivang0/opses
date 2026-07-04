// Evidence Query - a scoped, read-only ad-hoc query over captured telemetry for
// auditors. Pick a source (sessions / findings / tools), stack simple field
// filters, run them against POST /api/query, and export the result set to CSV.
// It is deliberately read-only: nothing on this page can mutate captured data,
// which is exactly the shape a compliance auditor is allowed to touch.
import { useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ChevronDown,
  Database,
  Download,
  Filter,
  Loader2,
  Lock,
  Play,
  Plus,
  Search,
  X,
  Zap,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { cn } from '../../lib/utils'
import { runQuery, type ApiQueryResult, type QueryFilter, type QuerySource } from '../../lib/api'

// Results are always capped server-side; we mirror the same ceiling here so the
// count line and the CSV both agree with what the server returned.
const LIMIT = 200

// The queryable columns per source. Kept in sync with the server contract so the
// field picker is populated before any query has run (the returned columns only
// arrive with a result).
const COLUMNS: Record<QuerySource, string[]> = {
  sessions: ['id', 'seat', 'tool', 'project', 'model', 'messages', 'tokensIn', 'tokensOut', 'costUSD', 'leaks', 'endedAt'],
  findings: ['id', 'seat', 'kind', 'severity', 'title', 'control', 'detectedAt'],
  tools: ['tool', 'seat', 'project', 'arg', 'ts'],
}

const SOURCES: { value: QuerySource; label: string }[] = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'findings', label: 'Findings' },
  { value: 'tools', label: 'Tools' },
]

// The operator vocabulary. Labels are plain-language for auditors; the value is
// the wire op the server understands.
const OPS: { value: QueryFilter['op']; label: string }[] = [
  { value: 'eq', label: 'is' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
]

// One-click starting points for the most common audit questions.
const CANNED: { label: string; source: QuerySource; filters: QueryFilter[] }[] = [
  { label: 'Sessions that leaked secrets', source: 'sessions', filters: [{ field: 'leaks', op: 'gt', value: '0' }] },
  { label: 'High-severity findings', source: 'findings', filters: [{ field: 'severity', op: 'eq', value: 'high' }] },
  { label: 'Every edit made', source: 'tools', filters: [{ field: 'tool', op: 'eq', value: 'Edit' }] },
  { label: 'Sessions over $1', source: 'sessions', filters: [{ field: 'costUSD', op: 'gt', value: '1' }] },
]

const emptyFilter = (source: QuerySource): QueryFilter => ({ field: COLUMNS[source][0], op: 'eq', value: '' })

// ---------------------------------------------------------------------------
// A labelled, chevron-decorated <select> matching the Sessions/Compare toolbar.
// ---------------------------------------------------------------------------
function Select({
  id,
  label,
  value,
  onChange,
  className,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-paper focus-visible:border-accent"
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV building + download - all client-side, no external libraries. Every field
// is escaped per RFC 4180 (wrap in quotes when it holds a comma, quote, or
// newline; double any embedded quotes) so the export survives Excel round-trips.
// ---------------------------------------------------------------------------
function escapeCsv(value: string | number | undefined): string {
  const s = value == null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(result: ApiQueryResult): string {
  const header = result.columns.map(escapeCsv).join(',')
  const lines = result.rows.map((row) => result.columns.map((col) => escapeCsv(row[col])).join(','))
  return [header, ...lines].join('\r\n')
}

function downloadCsv(result: ApiQueryResult): void {
  const blob = new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `opses-${result.source}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Numbers read cleanly with grouping in the table; the raw value still goes to
// CSV so downstream parsing is never fed a thousands separator.
function formatCell(value: string | number | undefined): string {
  if (value == null) return '-'
  return typeof value === 'number' ? value.toLocaleString('en-US') : value
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function EvidenceQuery() {
  const [source, setSource] = useState<QuerySource>('sessions')
  const [filters, setFilters] = useState<QueryFilter[]>([emptyFilter('sessions')])
  const [result, setResult] = useState<ApiQueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ran, setRan] = useState(false)

  // Switching source resets the filter fields (columns differ) and clears the
  // last result so a stale table never sits under a different source.
  function changeSource(next: QuerySource) {
    setSource(next)
    setFilters([emptyFilter(next)])
    setResult(null)
    setError(null)
    setRan(false)
  }

  function updateFilter(index: number, patch: Partial<QueryFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  function addFilter() {
    setFilters((prev) => [...prev, emptyFilter(source)])
  }

  // Explicit args let the canned queries run with values that state has not yet
  // committed (setState is async); the visible builder catches up on re-render.
  async function run(src: QuerySource = source, flt: QueryFilter[] = filters) {
    setLoading(true)
    setError(null)
    try {
      const active = flt.filter((f) => f.value.trim() !== '')
      const res = await runQuery(src, active, LIMIT)
      setResult(res)
    } catch {
      setResult(null)
      setError('The query service is unavailable right now. The in-house server could not be reached.')
    } finally {
      setLoading(false)
      setRan(true)
    }
  }

  function runCanned(q: (typeof CANNED)[number]) {
    setSource(q.source)
    setFilters(q.filters.map((f) => ({ ...f })))
    setResult(null)
    void run(q.source, q.filters)
  }

  const columns = COLUMNS[source]
  const hasRows = result !== null && result.rows.length > 0
  const numericCols = result
    ? new Set(result.columns.filter((c) => result.rows.some((r) => typeof r[c] === 'number')))
    : new Set<string>()

  const countLine = result
    ? `${result.count.toLocaleString()} row${result.count === 1 ? '' : 's'}` +
      (result.count > result.rows.length ? `, showing first ${result.rows.length.toLocaleString()}` : '')
    : ''

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Evidence Query"
        subtitle="Read-only, scoped queries over captured telemetry - for auditors, with CSV export."
      />

      {/* Query builder --------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Query builder</CardTitle>
              <CardDescription>
                Parameterized read over captured telemetry. Filters narrow the set; results are capped at {LIMIT} rows.
              </CardDescription>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-subtle">
              <Lock className="size-3" aria-hidden="true" />
              Read-only
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Source */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Database className="size-4 text-subtle" aria-hidden="true" />
              <span className="mono-eyebrow">Source</span>
            </div>
            <div
              role="group"
              aria-label="Choose the telemetry source to query"
              className="inline-flex rounded-lg border border-line bg-surface p-0.5"
            >
              {SOURCES.map((s) => {
                const active = source === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => changeSource(s.value)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                      active ? 'bg-accent/15 text-accent' : 'text-muted hover:text-paper',
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Canned queries */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Zap className="size-4 text-subtle" aria-hidden="true" />
              <span className="mono-eyebrow">Saved queries</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CANNED.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => runCanned(q)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-paper"
                >
                  <Zap className="size-3.5 text-accent" aria-hidden="true" />
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Filter className="size-4 text-subtle" aria-hidden="true" />
              <span className="mono-eyebrow">Filters</span>
            </div>
            {filters.length === 0 ? (
              <p className="mb-3 text-sm text-muted">
                No filters - the query returns everything in {source}, up to {LIMIT} rows.
              </p>
            ) : (
              <div className="space-y-2">
                {filters.map((f, i) => (
                  <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      id={`field-${i}`}
                      label="Filter field"
                      value={f.field}
                      onChange={(v) => updateFilter(i, { field: v })}
                      className="sm:w-44"
                    >
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                    <Select
                      id={`op-${i}`}
                      label="Filter operator"
                      value={f.op}
                      onChange={(v) => updateFilter(i, { op: v as QueryFilter['op'] })}
                      className="sm:w-32"
                    >
                      {OPS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => updateFilter(i, { value: e.target.value })}
                      placeholder="value"
                      aria-label="Filter value"
                      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-paper placeholder:text-subtle focus-visible:border-accent sm:flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(i)}
                      aria-label="Remove filter"
                      className="shrink-0"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={addFilter}>
                <Plus aria-hidden="true" />
                Add filter
              </Button>
            </div>
          </div>

          {/* Run */}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button onClick={() => run()} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              Run query
            </Button>
            <p className="text-xs text-subtle">Queries the in-house server. Nothing here writes back.</p>
          </div>
        </CardContent>
      </Card>

      {/* Results --------------------------------------------------------- */}
      {error ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          {error}
        </div>
      ) : result ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Results</CardTitle>
                <CardDescription className="font-mono text-xs">{countLine}</CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={() => downloadCsv(result)} disabled={!hasRows}>
                <Download aria-hidden="true" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {hasRows ? (
              <div className="max-h-[34rem] overflow-y-auto">
                <Table>
                  <THead className="sticky top-0 z-10 bg-surface">
                    <TR>
                      {result.columns.map((c) => (
                        <TH key={c} className={numericCols.has(c) ? 'text-right' : undefined}>
                          {c}
                        </TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {result.rows.map((row, ri) => (
                      <TR key={ri}>
                        {result.columns.map((c, ci) => {
                          const raw = row[c]
                          const numeric = numericCols.has(c)
                          return (
                            <TD
                              key={c}
                              title={numeric ? undefined : formatCell(raw)}
                              className={cn(
                                numeric
                                  ? 'text-right font-mono tabular-nums text-paper'
                                  : ci === 0
                                    ? 'max-w-[24rem] truncate text-paper'
                                    : 'max-w-[24rem] truncate text-muted',
                              )}
                            >
                              {formatCell(raw)}
                            </TD>
                          )
                        })}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            ) : (
              <p className="px-6 py-12 text-center text-sm text-muted">
                No rows matched these filters. Loosen a condition and run it again.
              </p>
            )}
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Running query...
        </div>
      ) : (
        // Initial state - nothing run yet.
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Search className="size-6 text-subtle" aria-hidden="true" />
            <p className="text-sm text-muted">
              {ran
                ? 'No results yet.'
                : 'Build a query above, or pick a saved query, then run it to see matching evidence.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
