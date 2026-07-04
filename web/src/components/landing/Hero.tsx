import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '../ui'
import { cn } from '../../lib/utils'
import { usePrefersReducedMotion } from './Reveal'

// One isometric cube (2:1 projection) as three polygons: top rhombus + left/right
// faces dropped by `depth`. Returned as point strings for <polygon>.
function isoCube(cx: number, cy: number, w: number, h: number, depth: number) {
  return {
    top: `${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`,
    left: `${cx - w},${cy} ${cx},${cy + h} ${cx},${cy + h + depth} ${cx - w},${cy + depth}`,
    right: `${cx},${cy + h} ${cx + w},${cy} ${cx + w},${cy + depth} ${cx},${cy + h + depth}`,
  }
}

const NODES: { x: number; y: number; s: number; label: string; mint?: boolean }[] = [
  { x: 232, y: 150, s: 30, label: 'CLAUDE CODE' },
  { x: 262, y: 300, s: 26, label: 'CURSOR', mint: true },
  { x: 890, y: 150, s: 30, label: 'CODEX' },
  { x: 858, y: 312, s: 26, label: 'MASKED', mint: true },
]

/**
 * IsoMotif - potpie-style isometric circuit scene. A glowing agent chip levitates
 * off a labeled in-house socket (rising to reveal a light column, then docking),
 * over a PCB board of traces and small components, with labeled coding-agent cubes
 * feeding masked data pulses inward to the core. Purely decorative.
 */
function IsoMotif({ reduced }: { reduced: boolean }) {
  const CX = 560
  const CY = 300
  const base = isoCube(CX, CY, 96, 48, 54) // in-house socket (bottom)
  const chip = isoCube(CX, CY - 46, 90, 45, 24) // levitating agent chip (top)
  const pins = [-42, -18, 6, 30]

  return (
    <svg
      viewBox="0 0 1120 460"
      className="h-auto w-full"
      role="img"
      aria-label="Isometric board: coding agents feed masked data to one in-house core"
    >
      {/* connectors + inward masked-data pulses from agents to the core */}
      {NODES.map((n, i) => (
        <g key={`c${i}`}>
          <line
            x1={CX}
            y1={CY - 20}
            x2={n.x}
            y2={n.y}
            className="opses-iso-line"
            strokeDasharray="2 7"
            opacity="0.45"
          />
          {!reduced && (
            <circle r="3" className={n.mint ? 'opses-iso-node--mint' : 'opses-iso-node'}>
              <animateMotion
                dur={`${3 + i * 0.5}s`}
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
                path={`M ${n.x} ${n.y} L ${CX} ${CY - 20}`}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.15;0.85;1"
                dur={`${3 + i * 0.5}s`}
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      ))}

      {/* labeled coding-agent cubes (float independently) */}
      {NODES.map((n, i) => {
        const c = isoCube(n.x, n.y, n.s, n.s / 2, n.s * 0.7)
        return (
          <g
            key={`n${i}`}
            className={reduced ? undefined : 'opses-iso-sat'}
            style={reduced ? undefined : { animationDuration: `${5 + i * 0.6}s`, animationDelay: `${i * 0.5}s` }}
          >
            <polygon points={c.left} className="opses-iso-line" />
            <polygon points={c.right} className="opses-iso-line" />
            <polygon points={c.top} className="opses-iso-line" />
            <circle
              cx={n.x}
              cy={n.y - n.s / 2 - 6}
              r="3.5"
              className={n.mint ? 'opses-iso-node--mint' : 'opses-iso-node'}
            />
            <text x={n.x} y={n.y + n.s * 0.7 + 24} textAnchor="middle" className="opses-iso-label">
              [ {n.label} ]
            </text>
          </g>
        )
      })}

      {/* in-house socket (base) */}
      <g>
        <polygon points={base.left} className="opses-iso-face" />
        <polygon points={base.right} className="opses-iso-face" />
        <polygon points={base.top} className="opses-iso-face" />
        {pins.map((dx, i) => (
          <line key={`p${i}`} x1={CX + dx} y1={CY - 3} x2={CX + dx} y2={CY - 22} className="opses-iso-pin">
            {!reduced && (
              <animate attributeName="opacity" values="0.35;1;0.35" dur={`${1.8 + i * 0.3}s`} repeatCount="indefinite" />
            )}
          </line>
        ))}
        <text x={CX} y={CY + 92} textAnchor="middle" className="opses-iso-label">
          [ LOCAL GEMMA CORE ]
        </text>
      </g>

      {/* light column - brightens exactly as the chip lifts */}
      <g className={reduced ? undefined : 'opses-beam'} opacity={reduced ? 0.35 : undefined}>
        {[-30, -14, 2, 18, 34].map((dx, i) => (
          <line
            key={`b${i}`}
            x1={CX + dx}
            y1={CY - 8}
            x2={CX + dx}
            y2={CY - 52}
            stroke="var(--color-accent)"
            strokeWidth="2"
            opacity="0.55"
          />
        ))}
      </g>

      {/* levitating agent chip (glowing) */}
      <g
        className={reduced ? undefined : 'opses-chip'}
        style={{ filter: 'drop-shadow(0 0 30px color-mix(in oklab, var(--color-accent) 50%, transparent))' }}
      >
        <polygon points={chip.left} className="opses-iso-core" />
        <polygon points={chip.right} className="opses-iso-core" />
        <polygon points={chip.top} className="opses-iso-face" />
        {/* OPSES shield-lock on the top face */}
        <g transform={`translate(${CX} ${CY - 48})`}>
          <rect x="-13" y="-1" width="26" height="17" rx="3" className="opses-iso-node" />
          <path d="M-7 -1 v-6 a7 7 0 0 1 14 0 v6" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
        </g>
      </g>
    </svg>
  )
}

/**
 * Hero - potpie-inspired: centered and geometric on the deep-emerald field with an
 * electric-lime accent, a lime marker-highlighted phrase, and a live isometric
 * circuit motif. Staggered load reveal, gated by prefers-reduced-motion.
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion()

  return (
    <section className="relative isolate overflow-hidden px-6 pt-32 pb-20 sm:pt-36">
      {/* blueprint grid + soft lime glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="opses-blueprint absolute inset-0" />
        <div
          className={cn(
            'opses-glow absolute left-1/2 top-[34%] h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2',
            !reduced && 'opses-glow--drift',
          )}
        />
      </div>

      <div className={cn('mx-auto flex max-w-4xl flex-col items-center text-center', !reduced && 'opses-anim')}>
        <span
          className="opses-fade inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted backdrop-blur"
          style={{ animationDelay: '0ms' }}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          In-house agent intelligence
        </span>

        <h1
          className="mt-7 font-sans font-bold tracking-[-0.03em] text-paper"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 5.5rem)', lineHeight: 1.03 }}
        >
          <span className="opses-line-mask block">
            <span className="opses-line" style={{ animationDelay: '80ms' }}>
              The control room for
            </span>
          </span>
          <span className="opses-line-mask block">
            <span className="opses-line" style={{ animationDelay: '170ms' }}>
              <span className="opses-mark">agentic AI</span>.
            </span>
          </span>
        </h1>

        <p
          className="opses-fade mt-7 max-w-2xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: '320ms' }}
        >
          OPSES captures every coding-agent prompt on your network, masks the secrets on the machine,
          and reasons over them with <span className="font-medium text-paper">Gemma 4 you host on-device</span>.
          Nothing leaves the building.
        </p>

        <div
          className="opses-fade mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: '440ms' }}
        >
          <Link to="/dashboard" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            View the console
            <ArrowRight />
          </Link>
          <a href="#pipeline" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            See how it works
          </a>
        </div>

        {/* tech pillars - the Google Cloud (local Gemma 4) + Cloudflare transport story */}
        <div
          className="opses-fade mt-9 flex flex-wrap items-center justify-center gap-2.5"
          style={{ animationDelay: '540ms' }}
        >
          {[
            'On-device Gemma 4 inference',
            'Cloudflare zero-knowledge transport',
            'Secrets masked on the machine',
          ].map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/50 px-3 py-1.5 text-xs text-muted"
            >
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
              {t}
            </span>
          ))}
        </div>

        <div
          className="opses-fade mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-subtle"
          style={{ animationDelay: '640ms' }}
        >
          <span>Mapped to</span>
          <span className="text-muted">EU AI Act</span>
          <span aria-hidden="true">·</span>
          <span className="text-muted">ISO 42001</span>
          <span aria-hidden="true">·</span>
          <span className="text-muted">NIST AI RMF</span>
        </div>
      </div>

      {/* full-width isometric circuit motif */}
      <div className="opses-fade mx-auto mt-10 w-full max-w-5xl" style={{ animationDelay: '760ms' }}>
        <IsoMotif reduced={reduced} />
      </div>
    </section>
  )
}
