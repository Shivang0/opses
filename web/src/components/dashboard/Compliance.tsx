import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Eyebrow, PageHeader } from '../ui'
import { ControlStatusBadge, ProgressMeter } from './indicators'
import { controlStatusMeta, frameworkFor, type ControlStatus } from './meta'
import { useOpses } from '../../lib/useOpses'

const STATUS_ORDER: ControlStatus[] = ['at_risk', 'monitored', 'ok']

export default function Compliance() {
  const { controls, org } = useOpses()
  const tally = (s: ControlStatus): number => controls.filter((c) => c.status === s).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Compliance"
        subtitle="Control coverage mapped to live findings across governance frameworks."
      />

      {/* Posture summary */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="max-w-md">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-paper">Overall compliance score</span>
              <span className="font-mono text-sm text-paper">
                {org.complianceScore}
                <span className="text-muted">/100</span>
              </span>
            </div>
            <ProgressMeter value={org.complianceScore} label="Overall compliance score" />
            <p className="mt-2 text-xs text-muted">
              {tally('at_risk')} controls at risk · target 90+
            </p>
          </div>
          <dl className="flex gap-6 sm:gap-8">
            {STATUS_ORDER.map((s) => (
              <div key={s}>
                <dt className="mono-eyebrow">{controlStatusMeta[s].label}</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-paper">
                  {tally(s)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Control cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {controls.map((c) => {
          const fw = frameworkFor(c.id)
          return (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 space-y-1">
                  <Eyebrow>{fw.framework}</Eyebrow>
                  <CardTitle>{c.label}</CardTitle>
                </div>
                <ControlStatusBadge status={c.status} />
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-subtle">{fw.ref}</span>
                {c.findings > 0 ? (
                  <Link
                    to="/dashboard/findings"
                    className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-accent transition-colors hover:text-paper"
                  >
                    {c.findings} open {c.findings === 1 ? 'finding' : 'findings'}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted">No findings</span>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
