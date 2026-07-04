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
    <div className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
      <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-subtle">{label}</p>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: 'var(--color-accent)' }}
          />
          Tokens
        </span>
        <span className="ml-auto font-mono tabular-nums text-paper">{tokens}M</span>
      </div>
      <div className="mt-1.5 flex items-center gap-6">
        <span className="flex items-center gap-1.5 text-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: 'var(--color-accent-2)' }}
          />
          Spend
        </span>
        <span className="ml-auto font-mono tabular-nums text-paper">${cost}</span>
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
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
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
            cursor={{ stroke: 'var(--color-line)', strokeWidth: 1 }}
          />
          <Area
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            name="Tokens"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#opses-tokens)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-accent)' }}
          />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            name="Spend"
            stroke="var(--color-accent-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-accent-2)' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
