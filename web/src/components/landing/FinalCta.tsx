import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Section, Eyebrow, buttonVariants } from '../ui'
import { Reveal } from './Reveal'

/**
 * FinalCta — closing call to action with a soft amber glow and the primary route
 * into the console.
 */
export default function FinalCta() {
  return (
    <Section container={false} className="relative isolate overflow-hidden text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="opses-glow absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <Reveal className="mx-auto max-w-3xl">
        <Eyebrow>Get started</Eyebrow>
        <h2
          className="mt-6 font-display font-medium tracking-[-0.02em] text-paper"
          style={{ fontSize: 'clamp(2.25rem, 6vw, 4.5rem)', lineHeight: 1 }}
        >
          Govern your agents. Keep your data.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
          See the console the same way a CISO does — live coverage, findings and framework evidence,
          all from data that never left the building.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className={buttonVariants({ variant: 'primary', size: 'md' })}>
            Open the console
            <ArrowRight />
          </Link>
          <a href="#compliance" className={buttonVariants({ variant: 'ghost', size: 'md' })}>
            Review compliance
          </a>
        </div>
      </Reveal>
    </Section>
  )
}
