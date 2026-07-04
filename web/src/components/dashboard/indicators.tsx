import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '../ui'
import { cn } from '../../lib/utils'
import {
  controlStatusMeta,
  riskBadgeVariant,
  riskLabel,
  riskLevel,
  type ControlStatus,
  type RiskLevel,
} from './meta'

const riskFill: Record<RiskLevel, string> = {
  high: 'bg-danger',
  medium: 'bg-warn',
  low: 'bg-ok',
}

/** Compact risk meter - colored track + numeric score, exposed as an ARIA meter. */
export function RiskMeter({ score, className }: { score: number; className?: string }) {
  const level = riskLevel(score)
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk score ${score} of 100`}
        className="block h-1.5 w-16 overflow-hidden rounded-full bg-line"
      >
        <span
          className={cn('block h-full rounded-full', riskFill[level])}
          style={{ width: `${score}%` }}
        />
      </span>
      <span className="font-mono text-sm tabular-nums text-paper">{score}</span>
    </div>
  )
}

/** Risk level as a colored pill (used in the developer slide-over). */
export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score)
  return (
    <Badge variant={riskBadgeVariant[level]}>
      {riskLabel[level]} risk · {score}
    </Badge>
  )
}

const statusIcon = { ok: ShieldCheck, at_risk: ShieldAlert, monitored: Activity }

/** Compliance control status chip (ok / at risk / monitored). */
export function ControlStatusBadge({ status }: { status: ControlStatus }) {
  const meta = controlStatusMeta[status]
  const Icon = statusIcon[status]
  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

/** Thin horizontal progress meter (e.g. the compliance score). */
export function ProgressMeter({
  value,
  max = 100,
  label,
  className,
}: {
  value: number
  max?: number
  /** Accessible name for the meter (required for the aria-meter-name a11y rule). */
  label?: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="meter"
      aria-label={`${label ?? 'Score'} ${value} of ${max}`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}
