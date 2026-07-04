import type { ComponentType } from 'react'
import { Radio, EyeOff, Lock, Waypoints, Cpu, ScrollText } from 'lucide-react'
import { Section, Eyebrow } from '../ui'
import { cn } from '../../lib/utils'
import { Reveal } from './Reveal'

type Step = {
  icon: ComponentType<{ className?: string }>
  label: string
  desc: string
  highlight?: boolean
}

const STEPS: Step[] = [
  { icon: Radio, label: 'Capture', desc: 'Intercept every coding-agent prompt on your own network.' },
  { icon: EyeOff, label: 'Mask', desc: 'Strip secrets, tokens and PII on the machine, before anything moves.' },
  { icon: Lock, label: 'Cloudflare tunnel', desc: 'Sealed end to end and tunneled over Cloudflare, zero-knowledge.' },
  { icon: Waypoints, label: 'Relay', desc: 'Routed only to the in-house governance engine, never a vendor.' },
  { icon: Cpu, label: 'Gemma 4', desc: 'Reviewed by Gemma 4 on a model you host, on-device.', highlight: true },
  { icon: ScrollText, label: 'Cited report', desc: 'Evidence-linked findings mapped to EU AI Act, ISO 42001 and NIST.' },
]

function IconBox({ step }: { step: Step }) {
  const Icon = step.icon
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-12 place-items-center rounded-xl border transition-colors',
        step.highlight
          ? 'border-accent/50 bg-accent/10 text-accent'
          : 'border-line bg-surface text-muted',
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}

function StepMeta({ step, index, center }: { step: Step; index: number; center?: boolean }) {
  return (
    <div className={cn(center && 'flex flex-col items-center text-center')}>
      <p className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.2em] text-subtle">
        <span className="tnum">{String(index + 1).padStart(2, '0')}</span>
        {step.highlight && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 tracking-[0.16em] text-accent">
            LOCAL
          </span>
        )}
      </p>
      <p className="mt-1.5 font-display text-lg font-medium text-paper">{step.label}</p>
      <p className={cn('mt-1 text-sm leading-relaxed text-muted', center && 'max-w-[20ch]')}>
        {step.desc}
      </p>
    </div>
  )
}

export default function PipelineSection() {
  return (
    <Section
      id="pipeline"
      className="scroll-mt-20 border-t border-line-soft bg-ink-2 sm:scroll-mt-24"
    >
      <Reveal className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-4 text-3xl font-medium text-paper sm:text-4xl">
          From prompt to cited report - without egress.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          A single one-way pipeline runs entirely inside your perimeter: secrets are masked on the
          machine, streamed over a Cloudflare zero-knowledge tunnel, and reviewed by Gemma 4 on a
          model you host. Nothing sensitive is ever relayed to a vendor.
        </p>
      </Reveal>

      <Reveal className="mt-16">
        {/* horizontal diagram (lg and up) */}
        <div className="hidden lg:block">
          <div aria-hidden="true" className="relative mb-8 h-3">
            <div className="absolute left-[8.333%] right-[8.333%] top-1/2 h-px -translate-y-1/2 bg-line" />
            <div className="relative grid grid-cols-6">
              {STEPS.map((s, i) => (
                <div key={i} className="flex justify-center">
                  <span
                    className={cn(
                      'size-3 rounded-full border',
                      s.highlight ? 'border-accent bg-accent' : 'border-line bg-surface-2',
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
          <ol className="grid grid-cols-6">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex flex-col items-center gap-3 px-3">
                <IconBox step={s} />
                <StepMeta step={s} index={i} center />
              </li>
            ))}
          </ol>
        </div>

        {/* vertical diagram (below lg) */}
        <ol className="relative lg:hidden">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex gap-4 pb-8 last:pb-0">
              <div aria-hidden="true" className="flex flex-col items-center pt-1">
                <span
                  className={cn(
                    'size-3 rounded-full border',
                    s.highlight ? 'border-accent bg-accent' : 'border-line bg-surface-2',
                  )}
                />
                {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </div>
              <div className="flex items-start gap-4 pb-1">
                <IconBox step={s} />
                <StepMeta step={s} index={i} />
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  )
}
