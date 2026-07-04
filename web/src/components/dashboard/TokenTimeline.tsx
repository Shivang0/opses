// TokenTimeline - a compact, hand-rolled SVG sparkline of assistant output tokens
// per turn for a single captured session. Area + line + an emphasized final point in
// the amber accent, normalized across the run's min..max so the shape reads at a
// glance; the absolute reference is the peak value shown in the caption. No chart
// lib. Renders nothing until at least two turns actually produced output.
import { useId } from 'react'
import type { ApiEvent } from '../../lib/api'

// viewBox is wide + short so the sparkline stays compact once scaled to 100% width.
const VW = 320
const VH = 44
const PAD_X = 5 // horizontal inset so the emphasized final point never clips the edge
const PAD_T = 7
const PAD_B = 6

export default function TokenTimeline({ events }: { events: ApiEvent[] }) {
  const fillId = useId()

  // Output tokens for each assistant turn that actually produced any, in order.
  const series = events
    .filter((e) => e.role === 'assistant' && typeof e.out === 'number' && e.out > 0)
    .map((e) => e.out ?? 0)

  if (series.length < 2) return null

  const peak = Math.max(...series)
  const low = Math.min(...series)
  const range = peak - low
  const innerW = VW - PAD_X * 2
  const innerH = VH - PAD_T - PAD_B
  const baseY = PAD_T + innerH

  const px = (i: number) => PAD_X + (i / (series.length - 1)) * innerW
  // Normalize across min..max so the shape reads; a flat run sits mid-height.
  const py = (v: number) => PAD_T + innerH * (1 - (range === 0 ? 0.5 : (v - low) / range))

  const pts = series.map((v, i) => ({ x: px(i), y: py(v) }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const first = pts[0]
  const last = pts[pts.length - 1]
  const area = `${line} L${last.x.toFixed(2)} ${baseY} L${first.x.toFixed(2)} ${baseY} Z`

  return (
    <figure className="m-0 rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2.5">
      <figcaption className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-subtle">
          Output tokens / turn
        </span>
        <span className="font-mono text-[0.72rem] tabular-nums">
          <span className="text-subtle">peak </span>
          <span className="text-paper">{peak.toLocaleString()}</span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="block h-auto w-full"
        style={{ aspectRatio: `${VW} / ${VH}` }}
        role="img"
        aria-label={`Output tokens per turn across ${series.length} assistant turns, peak ${peak.toLocaleString()}`}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* faint baseline */}
        <line
          x1={PAD_X}
          y1={baseY}
          x2={VW - PAD_X}
          y2={baseY}
          stroke="var(--color-line)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {/* area fill + line */}
        <path d={area} fill={`url(#${fillId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* emphasized final point */}
        <circle cx={last.x} cy={last.y} r={4} fill="var(--color-accent)" fillOpacity={0.18} />
        <circle cx={last.x} cy={last.y} r={2} fill="var(--color-accent)" />
      </svg>
    </figure>
  )
}
