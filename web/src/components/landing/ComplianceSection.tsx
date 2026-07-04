import type { ComponentType } from 'react'
import { ShieldCheck, BadgeCheck, Layers } from 'lucide-react'
import { Section, Eyebrow, Card } from '../ui'
import { Reveal } from './Reveal'

type Framework = {
  icon: ComponentType<{ className?: string }>
  code: string
  title: string
  body: string
}

const FRAMEWORKS: Framework[] = [
  {
    icon: ShieldCheck,
    code: 'EU · 2024/1689',
    title: 'EU AI Act',
    body: 'High-risk obligations for AI in the software lifecycle — logging, transparency and human oversight, evidenced continuously.',
  },
  {
    icon: BadgeCheck,
    code: 'ISO/IEC · 42001',
    title: 'ISO/IEC 42001',
    body: 'A working AI management system with the audit trail, risk controls and records certification assessors expect to see.',
  },
  {
    icon: Layers,
    code: 'NIST · AI RMF 1.0',
    title: 'NIST AI RMF',
    body: 'Govern, map, measure and manage — bound to concrete controls over every prompt that crosses your network.',
  },
]

export default function ComplianceSection() {
  return (
    <Section id="compliance" className="scroll-mt-20 border-t border-line-soft sm:scroll-mt-24">
      <Reveal className="max-w-2xl">
        <Eyebrow>Compliance</Eyebrow>
        <h2 className="mt-4 text-3xl font-medium text-paper sm:text-4xl">
          Mapped to the frameworks that matter.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Every governed prompt becomes evidence. OPSES keeps the records aligned to the standards
          your auditors and regulators already work from.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {FRAMEWORKS.map((f, i) => {
          const Icon = f.icon
          return (
            <Reveal key={f.title} className="h-full" delay={i * 90}>
              <Card className="group flex h-full flex-col p-7 transition duration-200 hover:-translate-y-0.5 hover:bg-surface-2">
                <div className="flex items-center justify-between">
                  <span className="mono-eyebrow">{f.code}</span>
                  <Icon className="size-5 text-subtle transition-colors group-hover:text-accent" />
                </div>
                <h3 className="mt-6 font-display text-xl font-medium text-paper">{f.title}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-muted">{f.body}</p>
                <div className="mt-6 flex items-center gap-2 border-t border-line-soft pt-4 font-mono text-xs text-subtle">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
                  Continuous evidence
                </div>
              </Card>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
