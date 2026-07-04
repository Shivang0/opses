import { cn } from '../../lib/utils'

/**
 * HeroMotif — an abstract "situation room" radar built from hairlines: concentric
 * rings, a crosshair grid, a slow amber sweep and a few signal blips. Purely
 * decorative (aria-hidden); the sweep/ping stop under prefers-reduced-motion via
 * the global rule in index.css.
 */
export default function HeroMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={cn('block', className)}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {/* crosshair grid */}
      <line x1="200" y1="16" x2="200" y2="384" className="opses-grid-line" strokeWidth="1" />
      <line x1="16" y1="200" x2="384" y2="200" className="opses-grid-line" strokeWidth="1" />
      <line
        x1="60"
        y1="60"
        x2="340"
        y2="340"
        className="opses-grid-line"
        strokeWidth="1"
        strokeDasharray="2 8"
      />
      <line
        x1="340"
        y1="60"
        x2="60"
        y2="340"
        className="opses-grid-line"
        strokeWidth="1"
        strokeDasharray="2 8"
      />

      {/* concentric rings */}
      <circle cx="200" cy="200" r="70" className="opses-ring--soft" fill="none" strokeWidth="1" />
      <circle cx="200" cy="200" r="120" className="opses-ring" strokeWidth="1" />
      <circle cx="200" cy="200" r="165" className="opses-ring--soft" fill="none" strokeWidth="1" />
      <circle cx="200" cy="200" r="190" className="opses-ring--accent" strokeWidth="1" />

      {/* rotating radar sweep */}
      <path d="M200 200 L200 20 A180 180 0 0 1 315.7 62 Z" className="opses-wedge" />
      <line x1="200" y1="200" x2="200" y2="20" className="opses-sweep-line" strokeWidth="1.5" />

      {/* signal blips */}
      <circle cx="200" cy="80" r="6" className="opses-ping" strokeWidth="1.5" />
      <circle cx="200" cy="80" r="3.5" className="opses-dot" />
      <circle cx="305" cy="168" r="3" className="opses-dot--mint" />
      <circle cx="126" cy="252" r="2.5" className="opses-dot" />
      <circle cx="252" cy="300" r="2.5" className="opses-dot--mint" />

      {/* core */}
      <circle cx="200" cy="200" r="16" className="opses-ring" strokeWidth="1" />
      <circle cx="200" cy="200" r="4" className="opses-dot" />
    </svg>
  )
}
