import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '../ui'
import { cn } from '../../lib/utils'
import HeroMotif from './HeroMotif'
import { usePrefersReducedMotion } from './Reveal'

/**
 * Hero — full-viewport, editorial. Oversized Fraunces headline over a grained
 * near-black field with a soft amber glow and an abstract radar motif bleeding
 * off the right edge. On load, an orchestrated staggered reveal runs
 * eyebrow -> title lines -> sub -> CTAs -> compliance rail (gated by
 * prefers-reduced-motion; otherwise everything is simply shown).
 */
export default function Hero() {
  const reduced = usePrefersReducedMotion()

  return (
    <section className="relative isolate flex min-h-[100svh] w-full flex-col justify-center overflow-hidden px-6 pt-28 pb-20 sm:pt-32">
      {/* amber glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={cn(
            'opses-glow absolute left-1/2 top-[44%] h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 sm:left-[36%] lg:h-[52rem] lg:w-[52rem]',
            !reduced && 'opses-glow--drift',
          )}
        />
      </div>

      {/* radar motif — bleeds off the right edge on large screens (grid-breaking) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden items-center lg:flex"
      >
        <HeroMotif className="h-[40rem] w-[40rem] translate-x-[22%] text-paper opacity-70" />
      </div>
      {/* faint centered echo behind the text on small screens */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center lg:hidden"
      >
        <HeroMotif className="h-[26rem] w-[26rem] opacity-20" />
      </div>

      <div className={cn('mx-auto w-full max-w-6xl', !reduced && 'opses-anim')}>
        <p className="opses-fade mono-eyebrow" style={{ animationDelay: '0ms' }}>
          OPSES · Runtime AI Governance
        </p>

        <h1
          className="mt-6 font-display font-medium tracking-[-0.02em] text-paper"
          style={{ fontSize: 'clamp(2.75rem, 8.6vw, 6.5rem)', lineHeight: 0.95 }}
        >
          <span className="opses-line-mask block">
            <span className="opses-line" style={{ animationDelay: '110ms' }}>
              Governance for
            </span>
          </span>
          <span className="opses-line-mask block">
            <span className="opses-line" style={{ animationDelay: '200ms' }}>
              agentic AI.
            </span>
          </span>
          <span className="opses-line-mask block">
            <span className="opses-line italic" style={{ animationDelay: '330ms' }}>
              Nothing leaves
            </span>
          </span>
          <span className="opses-line-mask block">
            <span className="opses-line italic" style={{ animationDelay: '420ms' }}>
              the building.
            </span>
          </span>
        </h1>

        <p
          className="opses-fade mt-8 max-w-xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: '580ms' }}
        >
          OPSES captures every coding-agent prompt on your network, masks the secrets, and runs the
          review on a model you host — so sensitive context is governed without ever reaching a
          third-party cloud.
        </p>

        <div
          className="opses-fade mt-9 flex flex-wrap items-center gap-3"
          style={{ animationDelay: '700ms' }}
        >
          <Link to="/dashboard" className={buttonVariants({ variant: 'primary', size: 'md' })}>
            View the console
            <ArrowRight />
          </Link>
          <a href="#pipeline" className={buttonVariants({ variant: 'ghost', size: 'md' })}>
            See how it works
          </a>
        </div>

        <div
          className="opses-fade mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft pt-5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-subtle"
          style={{ animationDelay: '840ms' }}
        >
          <span>Mapped to</span>
          <span className="text-muted">EU AI Act</span>
          <span aria-hidden="true">·</span>
          <span className="text-muted">ISO 42001</span>
          <span aria-hidden="true">·</span>
          <span className="text-muted">NIST AI RMF</span>
        </div>
      </div>
    </section>
  )
}
