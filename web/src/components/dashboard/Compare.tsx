import { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Info, Loader2, RefreshCw } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type ApiAnalyticsEditor } from '../../lib/api'
import { cn, formatCompact, formatUSD } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Compare - side-by-side editor comparison. Picks two editors (A in accent, B
// in accent-2) and lays their session/token/cost profiles next to each other
// with proportional dual-bars. Only Claude Code has captured data today, so the
// single-editor case is handled honestly: no second editor is ever fabricated.
// ---------------------------------------------------------------------------

// Sentinel for the "no editor B" option. Real editor names are never empty and
// never equal this, so it is safe as a distinct <select> value.
const NONE = '__none__'

// ---------------------------------------------------------------------------
// Derived per-editor stats - one pure pass over a raw editor row. All ratios
// guard against divide-by-zero so an idle editor reads as 0, never NaN.
// ---------------------------------------------------------------------------
interface EditorStats {
  editor: string
  sessions: number
  messages: number
  tokensIn: number
  tokensOut: number
  totalTokens: number
  cost: number
  avgTokensPerSession: number
  avgCostPerSession: number
  outInRatio: number
  messagesPerSession: number
}

function deriveStats(e: ApiAnalyticsEditor): EditorStats {
  const totalTokens = e.tokensIn + e.tokensOut
  return {
    editor: e.editor,
    sessions: e.sessions,
    messages: e.messages,
    tokensIn: e.tokensIn,
    tokensOut: e.tokensOut,
    totalTokens,
    cost: e.cost,
    avgTokensPerSession: e.sessions > 0 ? totalTokens / e.sessions : 0,
    avgCostPerSession: e.sessions > 0 ? e.cost / e.sessions : 0,
    outInRatio: e.tokensIn > 0 ? e.tokensOut / e.tokensIn : 0,
    messagesPerSession: e.sessions > 0 ? e.messages / e.sessions : 0,
  }
}

// "Busiest" first: most sessions, then most total tokens, then most messages.
function compareBusy(a: ApiAnalyticsEditor, b: ApiAnalyticsEditor): number {
  if (b.sessions !== a.sessions) return b.sessions - a.sessions
  const at = a.tokensIn + a.tokensOut
  const bt = b.tokensIn + b.tokensOut
  if (bt !== at) return bt - at
  return b.messages - a.messages
}

const fmtInt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

// The metric grid. Each row reads one derived number and formats it; higher is
// not framed as "better" anywhere - only magnitude and the leader are shown.
interface MetricDef {
  key: string
  label: string
  value: (s: EditorStats) => number
  format: (n: number) => string
}

const METRICS: MetricDef[] = [
  { key: 'sessions', label: 'Sessions', value: (s) => s.sessions, format: fmtInt },
  { key: 'messages', label: 'Messages', value: (s) => s.messages, format: fmtInt },
  { key: 'tokensIn', label: 'Tokens in', value: (s) => s.tokensIn, format: formatCompact },
  { key: 'tokensOut', label: 'Tokens out', value: (s) => s.tokensOut, format: formatCompact },
  { key: 'totalTokens', label: 'Total tokens', value: (s) => s.totalTokens, format: formatCompact },
  { key: 'cost', label: 'Cost', value: (s) => s.cost, format: formatUSD },
  {
    key: 'avgTokens',
    label: 'Avg tokens / session',
    value: (s) => s.avgTokensPerSession,
    format: formatCompact,
  },
  {
    key: 'avgCost',
    label: 'Avg cost / session',
    value: (s) => s.avgCostPerSession,
    format: formatUSD,
  },
  {
    key: 'outIn',
    label: 'Output:Input ratio',
    value: (s) => s.outInRatio,
    format: (n) => n.toFixed(2),
  },
  {
    key: 'msgsPer',
    label: 'Messages / session',
    value: (s) => s.messagesPerSession,
    format: (n) => n.toFixed(1),
  },
]

// Compact "who leads by how much" hint. Empty when there is nothing to say.
function ratioHint(a: number, b: number): string {
  if (a === b) return a === 0 ? '' : 'Even'
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (lo <= 0) return '' // one side has no data; the bar + bold value tell the story
  const r = hi / lo
  return r >= 100 ? `${Math.round(r)}x` : `${r.toFixed(1)}x`
}

// ---------------------------------------------------------------------------
// Editor summary tile - name + total tokens + cost, with a side-coloured dot.
// ---------------------------------------------------------------------------
function EditorTile({ stats, tone, side }: { stats: EditorStats; tone: 'a' | 'b'; side: string }) {
  const dot = tone === 'a' ? 'bg-accent' : 'bg-accent-2'
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-eyebrow">Editor {side}</p>
        <span className={cn('size-2.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      </div>
      <p className="mt-3 truncate font-display text-lg text-paper" title={stats.editor}>
        {stats.editor}
      </p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-paper">
          {formatCompact(stats.totalTokens)}
        </span>
        <span className="font-mono text-xs text-subtle">tokens</span>
      </div>
      <p className="mt-1 font-mono text-xs tabular-nums text-subtle">
        {formatUSD(stats.cost)} · {fmtInt(stats.sessions)} session{stats.sessions === 1 ? '' : 's'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One proportional bar within a metric row (A on top, B below). Width is
// normalised to the larger of the two values so the leader fills the track.
// ---------------------------------------------------------------------------
function BarRow({
  tone,
  pct,
  value,
  lead,
}: {
  tone: 'a' | 'b'
  pct: number
  value: string
  lead: boolean
}) {
  const color = tone === 'a' ? 'bg-accent' : 'bg-accent-2'
  return (
    <div className="flex items-center gap-3">
      <span className={cn('size-1.5 shrink-0 rounded-full', color)} aria-hidden="true" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn(
          'w-24 shrink-0 whitespace-nowrap text-right font-mono text-sm tabular-nums',
          lead ? 'font-medium text-paper' : 'text-muted',
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The head-to-head card: a legend binding colours to editors, then a metric
// row per measure with dual-bars and a subtle leader highlight.
// ---------------------------------------------------------------------------
function ComparisonCard({ a, b }: { a: EditorStats; b: EditorStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Head to head</CardTitle>
        <CardDescription>
          Higher is not always better - the bars show magnitude, the leading value is highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span className="truncate text-muted">{a.editor}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-accent-2" aria-hidden="true" />
            <span className="truncate text-muted">{b.editor}</span>
          </span>
        </div>
        <ul className="divide-y divide-line-soft">
          {METRICS.map((m) => {
            const av = m.value(a)
            const bv = m.value(b)
            const max = Math.max(av, bv, 0)
            const aPct = max > 0 && av > 0 ? Math.max(2, (av / max) * 100) : 0
            const bPct = max > 0 && bv > 0 ? Math.max(2, (bv / max) * 100) : 0
            const leader = av > bv ? 'a' : bv > av ? 'b' : 'even'
            const hint = ratioHint(av, bv)
            return (
              <li key={m.key} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">{m.label}</span>
                  {hint && (
                    <span className="font-mono text-[11px] tabular-nums text-subtle">{hint}</span>
                  )}
                </div>
                <div
                  className="mt-2.5 space-y-1.5"
                  role="img"
                  aria-label={`${m.label}. ${a.editor}: ${m.format(av)}. ${b.editor}: ${m.format(bv)}.`}
                >
                  <BarRow tone="a" pct={aPct} value={m.format(av)} lead={leader === 'a'} />
                  <BarRow tone="b" pct={bPct} value={m.format(bv)} lead={leader === 'b'} />
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Single-editor fallback: the full metric list for the one connected editor.
// ---------------------------------------------------------------------------
function SingleSummaryCard({ stats }: { stats: EditorStats }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <CardTitle>{stats.editor} at a glance</CardTitle>
        </div>
        <CardDescription>Full metric breakdown for the one connected editor.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-line-soft">
          {METRICS.map((m) => (
            <div key={m.key} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted">{m.label}</dt>
              <dd className="font-mono text-sm tabular-nums text-paper">{m.format(m.value(stats))}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Editor picker - a labelled <select> styled like the Sessions toolbar, with a
// side-coloured dot and an option disabled to keep A and B distinct.
// ---------------------------------------------------------------------------
function EditorPicker({
  id,
  label,
  tone,
  value,
  options,
  disabledValue,
  includeNone,
  onChange,
}: {
  id: string
  label: string
  tone: 'a' | 'b'
  value: string
  options: string[]
  disabledValue: string | null
  includeNone: boolean
  onChange: (value: string) => void
}) {
  const dot = tone === 'a' ? 'bg-accent' : 'bg-accent-2'
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2">
        <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
        <span className="mono-eyebrow">{label}</span>
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-paper focus-visible:border-accent"
        >
          {includeNone && <option value={NONE}>None (no other editor connected)</option>}
          {options.map((name) => (
            <option key={name} value={name} disabled={name === disabledValue}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Compare() {
  const { status, data, refetch } = useFetch(getAnalytics)
  // null = follow the computed default; a string is an explicit user choice.
  const [selA, setSelA] = useState<string | null>(null)
  const [selB, setSelB] = useState<string | null>(null)

  // Resolve the two selections against the live editor list. Defaults track the
  // busiest editors; the derivation always keeps A and B from colliding.
  const view = useMemo(() => {
    const ranked = [...(data?.editors ?? [])].sort(compareBusy)
    const names = ranked.map((e) => e.editor)
    const defaultA = names[0] ?? ''
    const defaultB = names[1] ?? NONE

    const editorA = selA && names.includes(selA) ? selA : defaultA
    let editorB = selB === null ? defaultB : selB
    if (editorB !== NONE && !names.includes(editorB)) editorB = defaultB // stale after a data change
    if (editorB === editorA) editorB = NONE // never compare an editor against itself

    const rawA = ranked.find((e) => e.editor === editorA)
    const rawB = editorB === NONE ? undefined : ranked.find((e) => e.editor === editorB)
    return {
      names,
      editorA,
      editorB,
      statsA: rawA ? deriveStats(rawA) : null,
      statsB: rawB ? deriveStats(rawB) : null,
    }
  }, [data, selA, selB])

  const subtitle =
    'Side-by-side editor comparison - efficiency, token usage, and session patterns.'

  // First load, nothing to show yet.
  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Console" title="Compare" subtitle={subtitle} />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading editors...
        </div>
      </div>
    )
  }

  // Never reached the server.
  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Compare"
          subtitle={subtitle}
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Editor comparison is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const { names, editorA, editorB, statsA, statsB } = view
  const isSingle = statsB === null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Compare"
        subtitle={subtitle}
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
            <RefreshCw
              className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      {names.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Info className="size-5 shrink-0 text-info" aria-hidden="true" />
          No editor activity has been captured yet. Once an editor runs a session it will show up
          here to compare.
        </div>
      ) : (
        <>
          {/* Pickers - A defaults to the busiest editor, B to the next busiest. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <EditorPicker
              id="cmp-editor-a"
              label="Editor A"
              tone="a"
              value={editorA}
              options={names}
              disabledValue={editorB === NONE ? null : editorB}
              includeNone={false}
              onChange={setSelA}
            />
            <EditorPicker
              id="cmp-editor-b"
              label="Editor B"
              tone="b"
              value={editorB}
              options={names}
              disabledValue={editorA}
              includeNone
              onChange={setSelB}
            />
          </div>

          {isSingle ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 text-sm text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p>
                  Only {statsA ? statsA.editor : 'Claude Code'} is connected right now. 16 more
                  editors are supported - connect them from Connections to compare.
                </p>
              </div>
              {statsA && <SingleSummaryCard stats={statsA} />}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {statsA && <EditorTile stats={statsA} tone="a" side="A" />}
                {statsB && <EditorTile stats={statsB} tone="b" side="B" />}
              </div>
              {statsA && statsB && <ComparisonCard a={statsA} b={statsB} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
