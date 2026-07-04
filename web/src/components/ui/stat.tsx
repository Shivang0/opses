import * as React from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/utils'

type StatTone = 'positive' | 'negative' | 'neutral'
type StatTrend = 'up' | 'down' | 'flat'

const toneClass: Record<StatTone, string> = {
  positive: 'text-ok',
  negative: 'text-danger',
  neutral: 'text-muted',
}

const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight }

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Small uppercase-ish caption above the value. */
  label: string
  /** The headline metric (rendered in the mono/tabular face). */
  value: React.ReactNode
  /** Optional change label, e.g. "+12%" or "3 new". */
  delta?: React.ReactNode
  /** Direction arrow shown before the delta. */
  trend?: StatTrend
  /** Colour of the delta — decoupled from arrow direction (more findings = bad). */
  tone?: StatTone
  /** Optional supporting caption below the value. */
  hint?: React.ReactNode
  /** Optional small icon slot (e.g. a lucide icon), boxed top-right. */
  icon?: React.ReactNode
}

/** Stat — KPI tile. Self-contained bordered surface; drop into a responsive grid. */
export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ className, label, value, delta, trend, tone = 'neutral', hint, icon, ...props }, ref) => {
    const TrendIcon = trend ? trendIcon[trend] : null
    return (
      <div
        ref={ref}
        className={cn('rounded-xl border border-border bg-surface p-5 shadow-sm', className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted">{label}</p>
          {icon && (
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-ink-soft [&_svg]:size-[18px]"
            >
              {icon}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums">
            {value}
          </span>
          {(delta != null || TrendIcon) && (
            <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', toneClass[tone])}>
              {TrendIcon && <TrendIcon className="size-3.5" aria-hidden="true" />}
              {delta}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      </div>
    )
  },
)
Stat.displayName = 'Stat'
