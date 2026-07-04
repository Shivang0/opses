import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { ToolSplitDatum } from '../../lib/useOpses'

const COLORS = ['var(--color-accent)', 'var(--color-accent-2)']

/** Two-tone donut of assistant adoption with a legend + share breakdown. */
export function ToolSplitChart({ data }: { data: ToolSplitDatum[] }) {
  const toolSplit = data
  const total = toolSplit.reduce((sum, t) => sum + t.value, 0)
  return (
    <div>
      <div className="relative mx-auto h-[168px] w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={toolSplit}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {toolSplit.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-semibold tabular-nums text-paper">{total}</span>
          <span className="mono-eyebrow mt-0.5">developers</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {toolSplit.map((t, i) => (
          <li key={t.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted">{t.name}</span>
            <span className="ml-auto font-mono tabular-nums text-subtle">
              {t.value} · {total > 0 ? Math.round((t.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
