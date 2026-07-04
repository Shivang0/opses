// Subscriptions - live view of the editor plans OPSES detects on each seat:
// plan tier, usage quota, remaining credits, renewal, and rate limits. Reads
// GET /api/subscriptions and degrades gracefully when the in-house server is
// unreachable, mirroring Analytics.
import { AlertCircle, AlertTriangle, CreditCard, Hourglass, LayoutGrid, Loader2, PowerOff, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, PageHeader, Stat } from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getSubscriptions, type ApiSubscription } from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Status pill meta - each subscription state maps to a Badge tone + label.
// ---------------------------------------------------------------------------
const statusMeta: Record<ApiSubscription['status'], { label: string; variant: 'ok' | 'info' | 'neutral' }> = {
  active: { label: 'Active', variant: 'ok' },
  trial: { label: 'Trial', variant: 'info' },
  inactive: { label: 'Idle', variant: 'neutral' },
}

// Small green pulse dot - echoes the header connection indicator. Shown inside
// the Active badge so a metered plan reads as streaming its usage live.
function LivePulse() {
  return (
    <span aria-hidden="true" className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
      <span className="relative inline-flex size-1.5 rounded-full bg-ok" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Plan card - one per detected seat: editor + tier, live status, a usage quota
// bar, renewal + rate limit, and any operator note. Idle seats are dimmed and
// lead with a warn-tinted reason so they read as needing attention.
// ---------------------------------------------------------------------------
function PlanCard({ sub }: { sub: ApiSubscription }) {
  const meta = statusMeta[sub.status]
  const isActive = sub.status === 'active'
  const isInactive = sub.status === 'inactive'
  const pct = sub.limit > 0 ? Math.min(100, Math.max(0, (sub.used / sub.limit) * 100)) : 0
  const remaining = sub.limit - sub.used
  const low = !isInactive && remaining <= 10

  return (
    <Card className={cn('flex flex-col gap-5 p-5', isInactive && 'opacity-70')}>
      {/* Editor + plan tier */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-paper">{sub.editor}</h3>
          <div className="mt-1.5">
            <Badge variant={meta.variant}>
              {isActive && <LivePulse />}
              {meta.label}
            </Badge>
          </div>
        </div>
        <Badge variant="neutral" className="shrink-0">
          {sub.plan}
        </Badge>
      </div>

      {/* Usage quota */}
      <div>
        <p className="mono-eyebrow">Usage</p>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line"
          role="img"
          aria-label={`${sub.used}% of ${sub.unit} used, ${remaining}% remaining`}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-xs">
          <span className="min-w-0 truncate text-muted">
            {sub.used}% of {sub.unit}
          </span>
          <span className={cn('shrink-0 tabular-nums', low ? 'text-warn' : 'text-subtle')}>
            {remaining}% left
          </span>
        </div>
      </div>

      {/* Renewal + rate limit */}
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <dt className="mono-eyebrow">Renews</dt>
          <dd className="mt-1 truncate text-sm text-paper">{sub.renews}</dd>
        </div>
        <div className="min-w-0">
          <dt className="mono-eyebrow">Rate limit</dt>
          <dd className="mt-1 truncate font-mono text-sm text-paper">{sub.rateLimit}</dd>
        </div>
      </dl>

      {/* Note - prominent + warn-tinted when idle, a quiet caption otherwise */}
      {isInactive
        ? sub.note && (
            <div className="mt-auto flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>{sub.note}</span>
            </div>
          )
        : sub.note && <p className="mt-auto text-xs text-subtle">{sub.note}</p>}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Subscriptions() {
  const { status, data, refetch } = useFetch(getSubscriptions)

  // First load, nothing to show yet.
  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Subscriptions"
          subtitle="Editor plans, usage quotas, remaining credits, and rate limits across your seats."
        />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading subscriptions...
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
          title="Subscriptions"
          subtitle="Editor plans, usage quotas, remaining credits, and rate limits across your seats."
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Subscriptions are unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const activePlans = data.filter((s) => s.status === 'active').length
  const trials = data.filter((s) => s.status === 'trial').length
  const idle = data.filter((s) => s.status === 'inactive').length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Subscriptions"
        subtitle="Editor plans, usage quotas, remaining credits, and rate limits across your seats."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active plans" value={activePlans} icon={<CreditCard />} hint={`of ${data.length} detected`} />
        <Stat label="Editors detected" value={data.length} icon={<LayoutGrid />} hint="Across your seats" />
        <Stat
          label="Trials"
          value={trials}
          icon={<Hourglass />}
          hint={trials === 0 ? 'None evaluating' : `${trials === 1 ? '1 plan' : `${trials} plans`} on trial`}
        />
        <Stat
          label="Idle"
          value={idle}
          icon={<PowerOff />}
          hint={idle > 0 ? 'Not currently scanning' : 'All seats connected'}
        />
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((sub) => (
          <PlanCard key={sub.editor} sub={sub} />
        ))}
      </div>
    </div>
  )
}
