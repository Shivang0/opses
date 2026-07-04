import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, ExternalLink } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { SlideOver } from './SlideOver'
import { bySeverityThenDate, formatDate, formatDateShort, severityLabel } from './meta'
import { KIND_LABEL, type Severity } from '../../data/sample'
import { useOpses, type ViewFinding } from '../../lib/useOpses'
import { formatUSD } from '../../lib/utils'

type Filter = 'all' | Severity
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

function SeverityFilter({
  value,
  onChange,
  counts,
}: {
  value: Filter
  onChange: (v: Filter) => void
  counts: Record<Filter, number>
}) {
  const count = (f: Filter): number => counts[f]
  return (
    <div
      role="group"
      aria-label="Filter findings by severity"
      className="inline-flex rounded-lg border border-line bg-surface p-0.5"
    >
      {FILTERS.map((f) => {
        const active = value === f.value
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-accent/15 text-accent' : 'text-muted hover:text-paper'
            }`}
          >
            {f.label}
            <span className="font-mono text-xs tabular-nums opacity-70">{count(f.value)}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-paper">{value}</dd>
    </div>
  )
}

function FindingDetail({ finding }: { finding: ViewFinding }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant={finding.severity}>{severityLabel[finding.severity]} severity</Badge>
        <span className="text-xs text-muted">Detected {formatDate(finding.detectedAt)}</span>
      </div>

      <p className="text-sm leading-relaxed text-muted">{finding.detail}</p>

      <div>
        <p className="mono-eyebrow mb-2">Evidence</p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-ink px-3 py-3 font-mono text-xs leading-relaxed text-muted">
          {finding.evidence}
        </pre>
      </div>

      {finding.savingsUSDPerDay != null && (
        <div className="rounded-lg border border-ok/25 bg-ok/15 px-3 py-2.5 text-sm text-ok">
          Estimated savings of {formatUSD(finding.savingsUSDPerDay)}/day if remediated.
        </div>
      )}

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        <Field label="Developer" value={finding.devName} />
        <Field label="Category" value={KIND_LABEL[finding.kind]} />
        <Field label="Control" value={finding.control} />
        <Field label="Citation" value={finding.citation} />
      </dl>
    </div>
  )
}

export default function Findings() {
  const { findings } = useOpses()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [activeId, setActiveId] = useState<string | null>(null)

  const deepLink = params.get('finding')
  useEffect(() => {
    if (deepLink && findings.some((f) => f.id === deepLink)) setActiveId(deepLink)
  }, [deepLink, findings])

  const counts: Record<Filter, number> = { all: findings.length, high: 0, medium: 0, low: 0 }
  for (const f of findings) counts[f.severity]++

  const close = useCallback(() => {
    setActiveId(null)
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('finding')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const rows = useMemo(() => {
    const list = filter === 'all' ? findings : findings.filter((f) => f.severity === filter)
    return [...list].sort(bySeverityThenDate)
  }, [filter, findings])

  const active = activeId ? (findings.find((f) => f.id === activeId) ?? null) : null
  // Retain the last opened finding so content stays visible while the panel slides out.
  const shownRef = useRef<ViewFinding | null>(null)
  if (active) shownRef.current = active
  const shown = shownRef.current

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Findings"
        subtitle="Policy violations and efficiency issues detected across sessions."
        actions={<SeverityFilter value={filter} onChange={setFilter} counts={counts} />}
      />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Severity</TH>
              <TH>Finding</TH>
              <TH>Developer</TH>
              <TH>Control</TH>
              <TH className="text-right">Detected</TH>
              <TH>
                <span className="sr-only">Open detail</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((f) => (
              <TR
                key={f.id}
                data-state={activeId === f.id ? 'selected' : undefined}
                onClick={() => setActiveId(f.id)}
                className="cursor-pointer"
              >
                <TD>
                  <Badge variant={f.severity}>{severityLabel[f.severity]}</Badge>
                </TD>
                <TD className="max-w-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveId(f.id)
                    }}
                    aria-haspopup="dialog"
                    className="rounded text-left"
                  >
                    <span className="block text-xs text-subtle">{KIND_LABEL[f.kind]}</span>
                    <span className="block truncate font-medium text-paper">{f.title}</span>
                  </button>
                </TD>
                <TD className="whitespace-nowrap text-paper">{f.devName}</TD>
                <TD className="whitespace-nowrap font-mono text-xs text-muted">{f.control}</TD>
                <TD className="whitespace-nowrap text-right text-muted">
                  {formatDateShort(f.detectedAt)}
                </TD>
                <TD className="text-right">
                  <ChevronRight aria-hidden="true" className="inline size-4 text-subtle" />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="border-t border-line px-3 py-2.5 font-mono text-xs text-subtle">
          Showing {rows.length} of {findings.length} findings
        </div>
      </Card>

      <SlideOver
        open={active !== null}
        onClose={close}
        eyebrow={shown ? <Eyebrow>{KIND_LABEL[shown.kind]}</Eyebrow> : undefined}
        title={shown?.title ?? ''}
        footer={
          shown ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-subtle">{shown.id.toUpperCase()}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/dashboard/developers?dev=${shown.dev}`)}
              >
                View developer
                <ExternalLink className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {shown && <FindingDetail finding={shown} />}
      </SlideOver>
    </div>
  )
}
