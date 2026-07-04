import type { ComponentType } from 'react'
import { Ghost, KeyRound, ScrollText, TriangleAlert } from 'lucide-react'
import { Section, Eyebrow } from '../ui'
import { cn } from '../../lib/utils'
import { Reveal, useReveal } from './Reveal'

type Problem = {
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
}

const PROBLEMS: Problem[] = [
  {
    icon: Ghost,
    title: 'Shadow AI is already here',
    body: 'Developers paste proprietary code into unsanctioned assistants every day - and you have no record it ever happened.',
  },
  {
    icon: KeyRound,
    title: 'Secrets ride along',
    body: 'API keys, access tokens and customer data leak into prompts and out to third-party models you do not control.',
  },
  {
    icon: ScrollText,
    title: 'No audit trail',
    body: 'Nothing is logged, nothing is attributable, and nothing is defensible when a regulator or a customer finally asks.',
  },
  {
    icon: TriangleAlert,
    title: 'Regulatory exposure',
    body: 'The EU AI Act and ISO 42001 assume evidence you cannot produce, for tools you cannot even see.',
  },
]

function ProblemItem({ index, item }: { index: number; item: Problem }) {
  const { ref, shown } = useReveal<HTMLLIElement>()
  const Icon = item.icon
  return (
    <li
      ref={ref}
      className={cn('opses-reveal border-t border-line pt-8', shown && 'is-in')}
      style={{ transitionDelay: `${index * 90}ms` }}
    >
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.24em] text-subtle">
        <span className="tnum">{String(index + 1).padStart(2, '0')}</span>
        <span aria-hidden="true" className="h-px w-8 bg-line" />
      </div>
      <div className="mt-6 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted"
        >
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-xl font-medium text-paper">{item.title}</h3>
          <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
        </div>
      </div>
    </li>
  )
}

export default function ProblemSection() {
  return (
    <Section id="problem" className="scroll-mt-20 sm:scroll-mt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-4 text-3xl font-medium text-paper sm:text-4xl">
          Your agents are already talking to the outside.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Coding agents are the fastest-moving unsanctioned channel in the enterprise. Every prompt
          is a potential exfiltration event - and today most of them are invisible.
        </p>
      </Reveal>

      <ol className="mt-16 grid grid-cols-1 gap-x-16 gap-y-10 sm:grid-cols-2">
        {PROBLEMS.map((item, i) => (
          <ProblemItem key={item.title} index={i} item={item} />
        ))}
      </ol>
    </Section>
  )
}
