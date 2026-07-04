import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ApiAnalyticsHour } from '../../lib/api'
import { formatHour } from './meta'

interface TooltipEntry {
  payload?: ApiAnalyticsHour
}
interface HourTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
}

function HourTooltip({ active, payload }: HourTooltipProps) {
  const datum = active && payload && payload.length > 0 ? payload[0].payload : undefined
  if (!datum) return null
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 text-sm shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
      <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-subtle">
        {formatHour(datum.hour)}
      </p>
      <div className="flex items-center gap-6">
        <span className="text-muted">Sessions</span>
        <span className="ml-auto font-mono tabular-nums text-paper">{datum.sessions}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-6">
        <span className="text-muted">Messages</span>
        <span className="ml-auto font-mono tabular-nums text-paper">{datum.messages}</span>
      </div>
    </div>
  )
}

/** Sessions per hour of day (0-23). The busiest hour is drawn in accent; the
    rest recede to a muted warm grey so the peak reads at a glance. */
export function HourActivityChart({
  hours,
  busiestHour,
}: {
  hours: ApiAnalyticsHour[]
  busiestHour: number
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={hours} margin={{ top: 10, right: 4, bottom: 0, left: -18 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            interval={2}
            tickMargin={10}
            tickFormatter={(h: number) => String(h).padStart(2, '0')}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'var(--color-subtle)', fontSize: 12 }}
          />
          <Tooltip content={<HourTooltip />} cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }} />
          <Bar dataKey="sessions" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {hours.map((h) => {
              const peak = h.hour === busiestHour
              return (
                <Cell
                  key={h.hour}
                  fill={peak ? 'var(--color-accent)' : 'var(--color-subtle)'}
                  fillOpacity={peak ? 1 : 0.4}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
