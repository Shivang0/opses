// OPSES Costs - estimated AI spend across models, editors, projects, and months,
// plus the most expensive individual sessions. Analytics drives every roll-up
// (the primary payload); the flat session list is a secondary source used only
// for the per-session table and degrades on its own if unreachable. Loading and
// error states mirror Analytics.tsx exactly.
import { AlertCircle, CalendarRange, Coins, Flame, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import { formatDateShort, shortModel } from './meta'
import { useFetch } from '../../lib/useFetch'
import {
  getAnalytics,
  getSessions,
  type ApiAnalytics,
  type ApiAnalyticsMonth,
  type ApiSessionRow,
} from '../../lib/api'
import { formatCompact, formatUSD } from '../../lib/utils'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Turn a 'YYYY-MM' month key into a readable 'Mon YYYY' label, e.g. '2026-07'
    -> 'Jul 2026'. Parsed numerically (no Date) so it never shifts across a
    timezone boundary. Falls back to the raw key if it cannot be parsed. */
function formatMonth(month: string): string {
  const [year, mm] = month.split('-')
  const idx = Number(mm) - 1
  if (!year || Number.isNaN(idx) || idx < 0 || idx > 11) return month
  return `${MONTH_ABBR[idx]} ${year}`
}

// ---------------------------------------------------------------------------
// Monthly spend - a dark-themed bar chart of estimated cost per calendar month.
// ---------------------------------------------------------------------------
interface MonthDatum {
  label: string
  cost: number
  sessions: number
  tokens: number
}

interface MonthTooltipEntry {
  payload?: MonthDatum
}
interface MonthTooltipProps {
  active?: boolean
  payload?: MonthTooltipEntry[]
}

function MonthlyTooltip({ active, payload }: MonthTooltipProps) {
  const datum = active && payload && payload.length > 0 ? payload[0].payload : undefined
  if (!datum) return null
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
      <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-subtle">{datum.label}</p>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-muted">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
          Spend
        </span>
        <span className="ml-auto font-mono tabular-nums text-paper">{formatUSD(datum.cost)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-6">
        <span className="text-muted">Sessions</span>
        <span className="ml-auto font-mono tabular-nums text-paper">{datum.sessions}</span>
      </div>
    </div>
  )
}

function MonthlySpendChart({ months }: { months: ApiAnalyticsMonth[] }) {
  const data: MonthDatum[] = months.map((m) => ({
    label: formatMonth(m.month),
    cost: m.cost,
    sessions: m.sessions,
    tokens: m.tokens,
  }))
  if (data.length === 0) {
    return <p className="text-sm text-muted">No monthly spend recorded yet.</p>
  }
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -6 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={12}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
            tickFormatter={(v: number) => `$${formatCompact(v)}`}
          />
          <Tooltip content={<MonthlyTooltip />} cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }} />
          <Bar
            dataKey="cost"
            fill="var(--color-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={72}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spend by model - horizontal cost bars scaled to the priciest model, with
// sessions and tokens underneath (mirrors Analytics' ModelDistribution, keyed
// on cost instead of tokens).
// ---------------------------------------------------------------------------
function SpendByModel({ models }: { models: ApiAnalytics['models'] }) {
  const rows = models.filter((m) => m.cost > 0).sort((a, b) => b.cost - a.cost)
  const max = rows[0]?.cost ?? 0
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No model spend recorded yet.</p>
  }
  return (
    <ul className="space-y-4">
      {rows.map((m) => {
        const pct = max > 0 ? Math.max(2, (m.cost / max) * 100) : 0
        return (
          <li key={m.model}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-sm text-paper">{shortModel(m.model)}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-paper">{formatUSD(m.cost)}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-subtle">
              <span>
                {m.sessions} session{m.sessions === 1 ? '' : 's'}
              </span>
              <span>{formatCompact(m.tokens)} tokens</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Spend by editor - same bar treatment across editors (reads fine with a single
// editor, where the bar simply fills). Tokens = input + output.
// ---------------------------------------------------------------------------
function SpendByEditor({ editors }: { editors: ApiAnalytics['editors'] }) {
  const rows = [...editors].sort((a, b) => b.cost - a.cost)
  const max = rows[0]?.cost ?? 0
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No editor spend recorded yet.</p>
  }
  return (
    <ul className="space-y-4">
      {rows.map((e) => {
        const tokens = e.tokensIn + e.tokensOut
        const pct = max > 0 ? Math.max(2, (e.cost / max) * 100) : 0
        return (
          <li key={e.editor}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-sm text-paper">{e.editor}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-paper">{formatUSD(e.cost)}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-subtle">
              <span>
                {e.sessions} session{e.sessions === 1 ? '' : 's'}
              </span>
              <span>{formatCompact(tokens)} tokens</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Spend by project - table sorted by cost descending.
// ---------------------------------------------------------------------------
function SpendByProject({ projects }: { projects: ApiAnalytics['projects'] }) {
  const rows = [...projects].sort((a, b) => b.cost - a.cost)
  if (rows.length === 0) {
    return <p className="p-6 pt-0 text-sm text-muted">No project spend recorded yet.</p>
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
// Model chips for the session table (matches the Sessions drill-down styling).
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
// Most expensive sessions - top 10 by estimated cost.
// ---------------------------------------------------------------------------
function TopSessions({ sessions }: { sessions: ApiSessionRow[] }) {
  const rows = [...sessions].sort((a, b) => b.costUSD - a.costUSD).slice(0, 10)
  if (rows.length === 0) {
    return <p className="p-6 pt-0 text-sm text-muted">No sessions recorded yet.</p>
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Project</TH>
          <TH>Developer</TH>
          <TH>Models</TH>
          <TH className="text-right">Tokens</TH>
          <TH className="text-right">Cost</TH>
          <TH className="text-right">Ended</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((s) => (
          <TR key={s.id}>
            <TD className="font-medium text-paper">{s.project}</TD>
            <TD className="whitespace-nowrap text-paper">{s.devName}</TD>
            <TD className="max-w-[12rem]">
              <ModelChips models={s.models} />
            </TD>
            <TD className="text-right font-mono tabular-nums text-paper">
              {formatCompact(s.tokensIn + s.tokensOut)}
            </TD>
            <TD className="text-right font-mono tabular-nums text-paper">{formatUSD(s.costUSD)}</TD>
            <TD className="whitespace-nowrap text-right text-muted">{formatDateShort(s.endedAt)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Costs() {
  const { status, data: analytics, refetch } = useFetch(getAnalytics)
  const { data: sessions } = useFetch(getSessions)

  // First load, nothing to show yet.
  if (status === 'loading' && !analytics) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Costs"
          subtitle="Estimated AI spend across models, editors, projects, and months."
        />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading costs...
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
          title="Costs"
          subtitle="Estimated AI spend across models, editors, projects, and months."
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Cost estimates are unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  // Total spend is summed from per-model cost (the brief's canonical figure).
  const totalSpend = analytics.models.reduce((sum, m) => sum + m.cost, 0)
  // One session belongs to exactly one project, so projects is a clean partition
  // to count total sessions for the per-session average.
  const totalSessions = analytics.projects.reduce((sum, p) => sum + p.sessions, 0)
  const avgPerSession = totalSessions > 0 ? totalSpend / totalSessions : 0
  const lastMonth = analytics.byMonth.length > 0 ? analytics.byMonth[analytics.byMonth.length - 1] : null
  const projectCount = analytics.projects.length
  // Priciest individual session (sessions may be unreachable while analytics is up).
  const priciest = (sessions ?? []).reduce<ApiSessionRow | null>(
    (top, s) => (top === null || s.costUSD > top.costUSD ? s : top),
    null,
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Costs"
        subtitle="Estimated AI spend across models, editors, projects, and months."
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
          label="Total spend"
          value={formatUSD(totalSpend)}
          icon={<Wallet />}
          hint={`Across ${projectCount} project${projectCount === 1 ? '' : 's'}`}
        />
        <Stat
          label="This month"
          value={formatUSD(lastMonth?.cost ?? 0)}
          icon={<CalendarRange />}
          hint={lastMonth ? formatMonth(lastMonth.month) : 'No monthly data yet'}
        />
        <Stat
          label="Most expensive session"
          value={priciest ? formatUSD(priciest.costUSD) : '-'}
          icon={<Flame />}
          hint={priciest ? priciest.project : sessions === null ? 'Sessions unavailable' : undefined}
        />
        <Stat
          label="Avg cost / session"
          value={formatUSD(avgPerSession)}
          icon={<Coins />}
          hint={`${formatCompact(totalSessions)} session${totalSessions === 1 ? '' : 's'}`}
        />
      </div>

      {/* Monthly spend + spend by editor */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Monthly spend</CardTitle>
            <CardDescription>Estimated cost per calendar month.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlySpendChart months={analytics.byMonth} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Spend by editor</CardTitle>
            <CardDescription>Cost attributed to each connected editor.</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendByEditor editors={analytics.editors} />
          </CardContent>
        </Card>
      </div>

      {/* Spend by model + spend by project */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Spend by model</CardTitle>
            <CardDescription>Estimated cost per model, with sessions and tokens.</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendByModel models={analytics.models} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 overflow-hidden">
          <CardHeader>
            <CardTitle>Spend by project</CardTitle>
            <CardDescription>Ranked by estimated cost.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <SpendByProject projects={analytics.projects} />
          </CardContent>
        </Card>
      </div>

      {/* Most expensive sessions */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Most expensive sessions</CardTitle>
          <CardDescription>The top 10 agent sessions by estimated cost.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {sessions === null ? (
            <p className="p-6 pt-0 text-sm text-muted">
              Session-level costs are unavailable right now. The in-house server could not be reached.
            </p>
          ) : (
            <TopSessions sessions={sessions} />
          )}
        </CardContent>
      </Card>

      <p className="font-mono text-xs text-subtle">
        Estimated from token counts x public list prices; cache reads billed at ~0.1x.
      </p>
    </div>
  )
}
