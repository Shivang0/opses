import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityDatum } from '../../lib/useOpses'

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
}
interface ActivityTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipEntry[]
}

function ActivityTooltip({ active, label, payload }: ActivityTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const tokens = payload.find((p) => p.dataKey === 'tokens')?.value
  const cost = payload.find((p) => p.dataKey === 'cost')?.value
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md">
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-ink-soft">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: 'var(--color-primary)' }}
          />
          Tokens
        </span>
        <span className="ml-auto font-mono tabular-nums text-ink">{tokens}M</span>
      </div>
      <div className="mt-1 flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-ink-soft">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: 'var(--color-ink-soft)' }}
          />
          Spend
        </span>
        <span className="ml-auto font-mono tabular-nums text-ink">${cost}</span>
      </div>
    </div>
  )
}

/** Org activity: tokens (area, left axis) and estimated spend (line, right axis). */
export function ActivityChart({ data }: { data: ActivityDatum[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="opses-tokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickMargin={10}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
          />
          <YAxis
            yAxisId="tokens"
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
            tickFormatter={(v: number) => `${v}M`}
          />
          <YAxis
            yAxisId="cost"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            content={<ActivityTooltip />}
            cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
          />
          <Area
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            name="Tokens"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#opses-tokens)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-primary)' }}
          />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            name="Spend"
            stroke="var(--color-ink-soft)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-ink-soft)' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
