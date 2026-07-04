// OPSES Dashboard - the console landing view. Two data sources feed it: the
// org-wide posture (useOpses, always present - live or bundled sample) and the
// richer session analytics (useFetch(getAnalytics), which may be null when the
// in-house server is unreachable). The org metrics always render; the analytics
// sections degrade gracefully - streak, calendar, and editor breakdown hide, and
// the model panel shows a quiet offline note - so the page never crashes offline.
import {
  AlertCircle,
  BadgeCheck,
  Clock,
  Coins,
  Flame,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
} from '../ui'
import { ActivityChart } from './ActivityChart'
import { ToolSplitChart } from './ToolSplitChart'
import { formatHour, shortModel } from './meta'
import { useOpses, type ConnStatus } from '../../lib/useOpses'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type ApiAnalytics } from '../../lib/api'
import { cn, formatCompact, formatUSD } from '../../lib/utils'

// Trailing window rendered by the activity calendar (weeks).
const HEAT_WEEKS = 13
// Sunday-first weekday rail; only the odd rows are labelled, GitHub-style.
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const
// Amber intensity for a non-empty heatmap bucket (1-4). Empty days use bg-line.
function heatOpacity(bucket: number): number {
  return 0.2 + (bucket / 4) * 0.8
}

// ---------------------------------------------------------------------------
// Connection pill - live / connecting / sample-data indicator for the header.
// ---------------------------------------------------------------------------
function ConnectionPill({ status }: { status: ConnStatus }) {
  const label = status === 'live' ? 'Live' : status === 'loading' ? 'Connecting' : 'Sample data'
  const dot =
    status === 'live'
      ? 'var(--color-ok)'
      : status === 'loading'
        ? 'var(--color-subtle)'
        : 'var(--color-accent)'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs text-muted">
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', status === 'live' && 'animate-pulse')}
        style={{ background: dot }}
      />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Legend chip used beside the activity-over-time chart.
// ---------------------------------------------------------------------------
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
      <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Coding streak - current run of active days, longest as the supporting hint.
// ---------------------------------------------------------------------------
function StreakCard({ streak }: { streak: ApiAnalytics['streak'] }) {
  return (
    <Card className="lg:col-span-4">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Coding streak</CardTitle>
          <CardDescription>Consecutive days with a session.</CardDescription>
        </div>
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent [&_svg]:size-[18px]"
        >
          <Flame />
        </span>
      </CardHeader>
      <CardContent>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums text-paper">
            {streak.current}
          </span>
          <span className="text-sm text-muted">day{streak.current === 1 ? '' : 's'} running</span>
        </p>
        <p className="mt-2 font-mono text-xs text-subtle">
          Longest streak {streak.longest} day{streak.longest === 1 ? '' : 's'}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Token economy - input vs cache-read vs output as a segmented bar + stats.
// Mirrors the Analytics view so both reads identically.
// ---------------------------------------------------------------------------
function TokenEconomyCard({ economy }: { economy: ApiAnalytics['tokenEconomy'] }) {
  const segments = [
    { key: 'input', label: 'Input', value: economy.input, color: 'var(--color-accent)' },
    { key: 'cacheRead', label: 'Cache reads', value: economy.cacheRead, color: 'var(--color-subtle)' },
    { key: 'output', label: 'Output', value: economy.output, color: 'var(--color-accent-2)' },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Token economy</CardTitle>
        <CardDescription>Input, cache reads, and generated output.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-line"
          role="img"
          aria-label={`Token economy: ${formatCompact(economy.input)} input, ${formatCompact(
            economy.cacheRead,
          )} cache reads, ${formatCompact(economy.output)} output.`}
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
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Token bars - shared horizontal token breakdown for models and editors. Rows
// arrive pre-sorted by tokens descending, so rows[0] is the scale maximum.
// ---------------------------------------------------------------------------
interface TokenBar {
  label: string
  tokens: number
  sessions: number
  cost: number
}
function TokenBars({ rows, emptyLabel }: { rows: TokenBar[]; emptyLabel: string }) {
  const max = rows[0]?.tokens ?? 0
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const pct = max > 0 ? Math.max(2, (r.tokens / max) * 100) : 2
        return (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-sm text-paper">{r.label}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-paper">
                {formatCompact(r.tokens)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-subtle">
              <span>
                {r.sessions} session{r.sessions === 1 ? '' : 's'}
              </span>
              <span>{formatUSD(r.cost)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Activity calendar - a GitHub-style heatmap of sessions per day over the
// trailing HEAT_WEEKS weeks. The grid is derived client-side from `daily` by
// walking day offsets out from today; no date library involved. Data is sparse
// by design - most cells sit empty and the few active days glow amber.
// ---------------------------------------------------------------------------
interface HeatCell {
  key: string
  col: number
  row: number
  sessions: number
  bucket: number
  label: string
}
interface HeatMonth {
  key: string
  col: number
  label: string
}
interface Heatmap {
  cells: HeatCell[]
  months: HeatMonth[]
  activeDays: number
  totalSessions: number
}

function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function buildHeatmap(daily: ApiAnalytics['daily'], weeks: number): Heatmap {
  const sessionsByDay = new Map<string, number>()
  for (const d of daily) sessionsByDay.set(d.date, d.sessions)
  const max = daily.reduce((m, d) => Math.max(m, d.sessions), 0)
  const denom = max || 1

  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const total = weeks * 7
  // Anchor so the final column holds the current week (Sun..Sat) and the top-left
  // cell is the Sunday `weeks` weeks back.
  const start = new Date(end)
  start.setDate(end.getDate() + (6 - end.getDay()) - (total - 1))

  const cells: HeatCell[] = []
  const months: HeatMonth[] = []
  let lastMonth = -1
  for (let i = 0; i < total; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    if (date.getTime() > end.getTime()) continue // future days stay blank
    const col = Math.floor(i / 7)
    const row = i % 7
    const sessions = sessionsByDay.get(isoDay(date)) ?? 0
    const bucket = sessions === 0 ? 0 : Math.min(4, Math.ceil((sessions / denom) * 4))
    cells.push({
      key: `${isoDay(date)}-${i}`,
      col,
      row,
      sessions,
      bucket,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
    if (row === 0 && date.getMonth() !== lastMonth) {
      months.push({ key: `${date.getMonth()}-${col}`, col, label: date.toLocaleDateString('en-US', { month: 'short' }) })
      lastMonth = date.getMonth()
    }
  }
  const active = cells.filter((c) => c.sessions > 0)
  return {
    cells,
    months,
    activeDays: active.length,
    totalSessions: active.reduce((sum, c) => sum + c.sessions, 0),
  }
}

function ActivityHeatmap({ daily }: { daily: ApiAnalytics['daily'] }) {
  const { cells, months, activeDays, totalSessions } = buildHeatmap(daily, HEAT_WEEKS)
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Coding activity over the last ${HEAT_WEEKS} weeks: ${activeDays} active day${
            activeDays === 1 ? '' : 's'
          }, ${totalSessions} session${totalSessions === 1 ? '' : 's'} in total.`}
          className="grid w-fit"
          style={{
            gridTemplateColumns: `auto repeat(${HEAT_WEEKS}, 14px)`,
            gridTemplateRows: 'auto repeat(7, 14px)',
            gap: '3px',
          }}
        >
          {months.map((m) => (
            <span
              key={m.key}
              className="whitespace-nowrap font-mono text-[10px] leading-none text-subtle"
              style={{ gridRowStart: 1, gridColumnStart: m.col + 2 }}
            >
              {m.label}
            </span>
          ))}
          {WEEKDAY_LABELS.map((w, r) => (
            <span
              key={`wd-${r}`}
              className="flex items-center pr-1 font-mono text-[10px] leading-none text-subtle"
              style={{ gridColumnStart: 1, gridRowStart: r + 2 }}
            >
              {w}
            </span>
          ))}
          {cells.map((c) => (
            <span
              key={c.key}
              title={`${c.sessions} session${c.sessions === 1 ? '' : 's'} on ${c.label}`}
              className={cn('rounded-[3px]', c.bucket === 0 && 'bg-line')}
              style={{
                gridColumnStart: c.col + 2,
                gridRowStart: c.row + 2,
                ...(c.bucket >= 1
                  ? { backgroundColor: 'var(--color-accent)', opacity: heatOpacity(c.bucket) }
                  : {}),
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-subtle">
          {activeDays} active day{activeDays === 1 ? '' : 's'} · {totalSessions} session
          {totalSessions === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-subtle">Less</span>
          {[0, 1, 2, 3, 4].map((b) => (
            <span
              key={b}
              aria-hidden="true"
              className={cn('size-3 rounded-[3px]', b === 0 && 'bg-line')}
              style={b >= 1 ? { backgroundColor: 'var(--color-accent)', opacity: heatOpacity(b) } : undefined}
            />
          ))}
          <span className="font-mono text-[10px] text-subtle">More</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Overview() {
  const { org, activity, toolSplit, status: connStatus, refetch: refetchOrg } = useOpses()
  const { status: analyticsStatus, data: analytics, refetch: refetchAnalytics } = useFetch(getAnalytics)

  const analyticsLoading = analyticsStatus === 'loading' && !analytics
  const toolBreakdown = toolSplit.map((t) => `${t.value} ${t.name}`).join(' · ')

  // Analytics-derived rows, only computed when the payload is present.
  const peakHour = analytics ? analytics.hours.find((h) => h.hour === analytics.busiestHour) : undefined
  const modelRows: TokenBar[] = analytics
    ? analytics.models
        .filter((m) => m.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 5)
        .map((m) => ({ label: shortModel(m.model), tokens: m.tokens, sessions: m.sessions, cost: m.cost }))
    : []
  const editorRows: TokenBar[] = analytics
    ? analytics.editors
        .map((e) => ({ label: e.editor, tokens: e.tokensIn + e.tokensOut, sessions: e.sessions, cost: e.cost }))
        .filter((e) => e.tokens > 0 || e.sessions > 0)
        .sort((a, b) => b.tokens - a.tokens)
    : []

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Dashboard"
        subtitle="Every coding-agent session on your network, at a glance."
        actions={
          <>
            <ConnectionPill status={connStatus} />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                refetchAnalytics()
                refetchOrg()
              }}
              disabled={analyticsStatus === 'loading'}
            >
              <RefreshCw
                className={analyticsStatus === 'loading' ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Active developers"
          value={org.activeDevs}
          icon={<Users />}
          hint={toolBreakdown || 'No assistants detected'}
        />
        <Stat
          label="Spend this month"
          value={formatUSD(org.costMTD)}
          icon={<Wallet />}
          hint={`Across ${org.activeDevs} developer${org.activeDevs === 1 ? '' : 's'}`}
        />
        <Stat
          label="Tokens this month"
          value={formatCompact(org.tokensMTD)}
          icon={<Coins />}
          hint="Input + output"
        />
        <Stat
          label="Open findings"
          value={org.openFindings}
          icon={<ShieldAlert />}
          trend="up"
          tone="negative"
          delta={`${org.bySeverity.high} high`}
          hint={`${org.bySeverity.medium} medium · ${org.bySeverity.low} low`}
        />
        <Stat
          label="Compliance score"
          value={
            <>
              {org.complianceScore}
              <span className="text-lg font-medium text-subtle">/100</span>
            </>
          }
          icon={<BadgeCheck />}
          hint={org.complianceScore >= 90 ? 'Meets target' : 'Target 90'}
        />
      </div>

      {/* Streak + peak hour + token economy */}
      {analytics ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <StreakCard streak={analytics.streak} />
          <Stat
            className="lg:col-span-4"
            label="Peak hour"
            value={formatHour(analytics.busiestHour)}
            icon={<Clock />}
            hint={
              peakHour
                ? `${peakHour.sessions} session${peakHour.sessions === 1 ? '' : 's'} in this window`
                : 'Busiest window'
            }
          />
          <TokenEconomyCard economy={analytics.tokenEconomy} />
        </div>
      ) : analyticsLoading ? (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-5 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading session analytics...
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-muted">
            <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
            Session analytics are offline - streak, activity calendar, and editor breakdown need the
            in-house server. The posture metrics above reflect the latest sync.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={refetchAnalytics}
            className="shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {/* Activity calendar + editor breakdown */}
      {analytics && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>Activity calendar</CardTitle>
              <CardDescription>
                Sessions per day across the last {HEAT_WEEKS} weeks - active days glow amber.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap daily={analytics.daily} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Editor breakdown</CardTitle>
              <CardDescription>Tokens by assistant, with sessions and cost.</CardDescription>
            </CardHeader>
            <CardContent>
              <TokenBars rows={editorRows} emptyLabel="No editor activity recorded yet." />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activity over time */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Activity over time</CardTitle>
            <CardDescription>Org-wide tokens and estimated spend per day.</CardDescription>
          </div>
          <div className="hidden shrink-0 items-center gap-4 sm:flex">
            <LegendItem color="var(--color-accent)" label="Tokens (M)" />
            <LegendItem color="var(--color-accent-2)" label="Spend ($)" />
          </div>
        </CardHeader>
        <CardContent>
          <ActivityChart data={activity} />
        </CardContent>
      </Card>

      {/* Top models + tool adoption */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Top models</CardTitle>
            <CardDescription>Ranked by tokens, with sessions and estimated cost.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics ? (
              <TokenBars rows={modelRows} emptyLabel="No model usage recorded yet." />
            ) : analyticsLoading ? (
              <p className="flex items-center gap-2 py-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading model usage...
              </p>
            ) : (
              <p className="flex items-center gap-2 py-2 text-sm text-muted">
                <AlertCircle className="size-4 shrink-0 text-warn" aria-hidden="true" />
                Model usage is offline.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Tool adoption</CardTitle>
            <CardDescription>Assistants in use across the org.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToolSplitChart data={toolSplit} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
