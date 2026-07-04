import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import {
  Badge,
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
import { RiskMeter } from './indicators'
import { SlideOver } from './SlideOver'
import { EmployeeDetail } from './EmployeeDetail'
import { useOpses, type DevRow } from '../../lib/useOpses'
import { formatCompact, formatUSD } from '../../lib/utils'

function RiskLegend() {
  const items = [
    { label: 'High', className: 'bg-danger' },
    { label: 'Elevated', className: 'bg-warn' },
    { label: 'Low', className: 'bg-ok' },
  ]
  return (
    <div className="flex items-center gap-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden="true" className={`size-2 rounded-full ${it.className}`} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export default function Developers() {
  const { developers, findings } = useOpses()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)

  const deepLink = params.get('dev')
  useEffect(() => {
    if (deepLink && developers.some((d) => d.id === deepLink)) setActiveId(deepLink)
  }, [deepLink, developers])

  const close = useCallback(() => {
    setActiveId(null)
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('dev')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const activeDev = activeId ? (developers.find((d) => d.id === activeId) ?? null) : null
  // Retain the last opened developer so content stays visible while the panel slides out.
  const shownRef = useRef<DevRow | null>(null)
  if (activeDev) shownRef.current = activeDev
  const shown = shownRef.current

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Developers"
        subtitle="Per-engineer usage, spend, and risk across coding assistants."
        actions={<RiskLegend />}
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Developer</TH>
              <TH>Tools</TH>
              <TH className="text-right">Sessions</TH>
              <TH className="text-right">Tokens</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">MCP</TH>
              <TH>Risk</TH>
              <TH>
                <span className="sr-only">Open detail</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {developers.map((d) => (
              <TR
                key={d.id}
                data-state={activeId === d.id ? 'selected' : undefined}
                onClick={() => setActiveId(d.id)}
                className="cursor-pointer"
              >
                <TD>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveId(d.id)
                    }}
                    aria-haspopup="dialog"
                    className="rounded text-left font-medium text-ink transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    {d.name}
                  </button>
                  <span className="mt-0.5 block text-xs text-muted">{d.sublabel}</span>
                </TD>
                <TD>
                  <span className="flex flex-wrap gap-1">
                    {d.tools.map((t) => (
                      <Badge key={t} variant="neutral">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </TD>
                <TD className="text-right font-mono tabular-nums">{d.sessions}</TD>
                <TD className="text-right font-mono tabular-nums">{formatCompact(d.tokens)}</TD>
                <TD className="text-right font-mono tabular-nums">{formatUSD(d.costUSD)}</TD>
                <TD className="text-right font-mono tabular-nums">{d.mcpCount}</TD>
                <TD>
                  <RiskMeter score={d.riskScore} />
                </TD>
                <TD className="text-right">
                  <ChevronRight aria-hidden="true" className="inline size-4 text-subtle" />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <SlideOver
        open={activeDev !== null}
        onClose={close}
        eyebrow={<Eyebrow>Developer</Eyebrow>}
        title={shown?.name ?? ''}
      >
        {shown && (
          <EmployeeDetail
            dev={shown}
            findings={findings}
            onOpenFinding={(id) => navigate(`/dashboard/findings?finding=${id}`)}
          />
        )}
      </SlideOver>
    </div>
  )
}
