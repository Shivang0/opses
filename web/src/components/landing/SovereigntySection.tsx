import { Eyebrow } from '../ui'
import { Reveal } from './Reveal'

/**
 * SovereigntySection — the full-bleed emotional beat. Oversized Fraunces
 * statement on an alternate band, a single amber underline as the sole accent.
 */
export default function SovereigntySection() {
  return (
    <section className="relative isolate overflow-hidden bg-ink-2 px-6 py-28 sm:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="opses-glow absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <Reveal className="mx-auto max-w-4xl text-center">
        <Eyebrow>Data sovereignty</Eyebrow>
        <p
          className="mt-7 font-display font-medium tracking-[-0.02em] text-paper"
          style={{ fontSize: 'clamp(2rem, 5.6vw, 4rem)', lineHeight: 1.04 }}
        >
          Your developers&rsquo; prompts{' '}
          <span className="italic underline decoration-accent decoration-2 underline-offset-[10px]">
            never leave
          </span>{' '}
          your network.
        </p>
        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted">
          Capture, masking and review all run on infrastructure you own. Pull the cable and OPSES
          still works — because nothing was ever meant to leave the building.
        </p>
      </Reveal>
    </section>
  )
}
