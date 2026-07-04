import { Activity, AlertCircle, Boxes, CalendarRange, Clock, Loader2, RefreshCw } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { HourActivityChart } from './HourActivityChart'
import ToolDrilldown from './ToolDrilldown'
import { formatHour, shortModel } from './meta'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type ApiAnalytics } from '../../lib/api'
import { formatCompact, formatUSD } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Model distribution - horizontal token bars, sessions + cost per model.
// ---------------------------------------------------------------------------
function ModelDistribution({ models }: { models: ApiAnalytics['models'] }) {
  // Only models that actually consumed tokens (drops <synthetic>/unknown), by tokens desc.
  const rows = models.filter((m) => m.tokens > 0).sort((a, b) => b.tokens - a.tokens)
  const max = rows[0]?.tokens ?? 0
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No model usage recorded yet.</p>
  }
  return (
    <ul className="space-y-4">
      {rows.map((m) => {
        const pct = max > 0 ? Math.max(2, (m.tokens / max) * 100) : 0
        return (
          <li key={m.model}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-sm text-paper">{shortModel(m.model)}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-paper">
                {formatCompact(m.tokens)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-subtle">
              <span>
                {m.sessions} session{m.sessions === 1 ? '' : 's'}
              </span>
              <span>{formatUSD(m.cost)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Token economy - input vs cache-read vs output as a segmented bar + stats.
// ---------------------------------------------------------------------------
function TokenEconomy({ economy }: { economy: ApiAnalytics['tokenEconomy'] }) {
  const segments = [
    { key: 'input', label: 'Input', value: economy.input, color: 'var(--color-accent)' },
    { key: 'cacheRead', label: 'Cache reads', value: economy.cacheRead, color: 'var(--color-subtle)' },
    { key: 'output', label: 'Output', value: economy.output, color: 'var(--color-accent-2)' },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={`Token economy: ${formatCompact(economy.input)} input, ${formatCompact(
          economy.cacheRead,
        )} cache reads, ${formatCompact(economy.output)} output`}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, background: s.color }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.label}
            </dt>
            <dd className="mt-1 font-mono text-base font-medium tabular-nums text-paper">
              {formatCompact(s.value)}
            </dd>
            <dd className="font-mono text-[11px] tabular-nums text-subtle">{pctOf(s.value)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top projects - table sorted by tokens.
// ---------------------------------------------------------------------------
function TopProjects({ projects }: { projects: ApiAnalytics['projects'] }) {
  const rows = [...projects].sort((a, b) => b.tokens - a.tokens)
  if (rows.length === 0) {
    return <p className="p-6 pt-0 text-sm text-muted">No project activity recorded yet.</p>
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Project</TH>
          <TH className="text-right">Sessions</TH>
          <TH className="text-right">Tokens</TH>
          <TH className="text-right">Cost</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((p) => (
          <TR key={p.project}>
            <TD className="font-medium text-paper">{p.project}</TD>
            <TD className="text-right font-mono tabular-nums text-paper">{p.sessions}</TD>
            <TD className="text-right font-mono tabular-nums text-paper">{formatCompact(p.tokens)}</TD>
            <TD className="text-right font-mono tabular-nums text-paper">{formatUSD(p.cost)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Analytics() {
  const { status, data, refetch } = useFetch(getAnalytics)

  // First load, nothing to show yet.
  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Console" title="Analytics" subtitle="Usage patterns across agent sessions." />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading analytics...
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
          title="Analytics"
          subtitle="Usage patterns across agent sessions."
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Analytics are unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const totalSessions = data.hours.reduce((sum, h) => sum + h.sessions, 0)
  const totalMessages = data.hours.reduce((sum, h) => sum + h.messages, 0)
  const modelsUsed = data.models.filter((m) => m.tokens > 0).length
  const peak = data.hours.find((h) => h.hour === data.busiestHour)
  const topModel = [...data.models].filter((m) => m.tokens > 0).sort((a, b) => b.tokens - a.tokens)[0]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Analytics"
        subtitle="Usage patterns across agent sessions - hours, models, tokens, and projects."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total sessions"
          value={totalSessions}
          icon={<Activity />}
          hint={`${formatCompact(totalMessages)} messages`}
        />
        <Stat
          label="Models used"
          value={modelsUsed}
          icon={<Boxes />}
          hint={topModel ? `Top: ${shortModel(topModel.model)}` : 'No models yet'}
        />
        <Stat
          label="Busiest hour"
          value={formatHour(data.busiestHour)}
          icon={<Clock />}
          hint={peak ? `${peak.sessions} sessions` : undefined}
        />
        <Stat
          label="Active days"
          value={data.activeDays}
          icon={<CalendarRange />}
          hint={`${data.projects.length} project${data.projects.length === 1 ? '' : 's'}`}
        />
      </div>

      {/* Peak hours + token economy */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Activity by hour</CardTitle>
            <CardDescription>Sessions per hour of day - the busiest hour is highlighted.</CardDescription>
          </CardHeader>
          <CardContent>
            <HourActivityChart hours={data.hours} busiestHour={data.busiestHour} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Token economy</CardTitle>
            <CardDescription>Input, cache reads, and generated output.</CardDescription>
          </CardHeader>
          <CardContent>
            <TokenEconomy economy={data.tokenEconomy} />
          </CardContent>
        </Card>
      </div>

      {/* Model distribution + top projects */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Model distribution</CardTitle>
            <CardDescription>Tokens by model, with sessions and estimated cost.</CardDescription>
          </CardHeader>
          <CardContent>
            <ModelDistribution models={data.models} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 overflow-hidden">
          <CardHeader>
            <CardTitle>Top projects</CardTitle>
            <CardDescription>Ranked by tokens consumed.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <TopProjects projects={data.projects} />
          </CardContent>
        </Card>
      </div>

      {/* Tool drill-down - the agent tool-call audit trail */}
      <ToolDrilldown />
    </div>
  )
}
