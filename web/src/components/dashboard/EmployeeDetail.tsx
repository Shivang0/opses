import { useId, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, ShieldCheck } from 'lucide-react'
import { Badge } from '../ui'
import { RiskBadge } from './indicators'
import { severityLabel } from './meta'
import { cn, formatCompact, formatUSD } from '../../lib/utils'
import { useEmployeeDetail, type DevRow, type ViewFinding } from '../../lib/useOpses'
import type { ApiSession, ApiTool } from '../../lib/api'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Trim the noisy prefix/date-suffix off a model id for compact display. */
function shortModel(m: string): string {
  return m.replace(/^claude-/, '').replace(/-\d{6,}$/, '')
}

// ---------------------------------------------------------------------------
// Quick-facts grid (works from the summary row alone, live or sample)
// ---------------------------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-ink">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A single Claude Code session, expandable to its event trail.
// ---------------------------------------------------------------------------
function SessionRow({ session }: { session: ApiSession }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const leakCount = session.leaks?.length ?? 0
  const events = session.events ?? []

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {open ? (
          <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-subtle" />
        ) : (
          <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-subtle" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-ink">{session.project}</span>
            {leakCount > 0 && (
              <Badge variant="high">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {leakCount} leak{leakCount === 1 ? '' : 's'}
              </Badge>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted">
            <span>{fmtWhen(session.endedAt || session.startedAt)}</span>
            <span>{session.messages} msgs</span>
            <span>{formatCompact(session.tokensIn)} in</span>
            <span>{formatCompact(session.tokensOut)} out</span>
            <span className="text-ink-soft">{formatUSD(session.costUSD)}</span>
          </span>
          {session.models?.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {session.models.map((m) => (
                <span
                  key={m}
                  className="rounded border border-border bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-subtle"
                >
                  {shortModel(m)}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t border-border bg-canvas/60 p-3">
          {events.length === 0 ? (
            <p className="text-xs text-muted">No event trail captured for this session.</p>
          ) : (
            <ol className="space-y-2">
              {events.map((ev, i) => (
                <li key={`${ev.ts}-${i}`} className="flex gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-4 shrink-0 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide',
                      ev.role === 'assistant'
                        ? 'bg-primary-soft text-primary'
                        : 'bg-canvas text-muted ring-1 ring-inset ring-border',
                    )}
                  >
                    {ev.role === 'assistant' ? 'AI' : 'You'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs leading-relaxed text-ink-soft">
                      {ev.textPreview || '—'}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-subtle">
                      {ev.model && <span>{shortModel(ev.model)}</span>}
                      {ev.out != null && <span>{ev.out} tok</span>}
                      <span>{fmtWhen(ev.ts)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Claude Code tab — totals + real sessions, newest first.
// ---------------------------------------------------------------------------
function ClaudeCodeTab({ tool }: { tool: ApiTool }) {
  const sessions = [...(tool.sessions ?? [])].sort((a, b) =>
    (b.endedAt || b.startedAt || '').localeCompare(a.endedAt || a.startedAt || ''),
  )
  const totals = tool.totals
  const models = Object.entries(totals?.byModel ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div className="space-y-4">
      {totals && (
        <div className="space-y-3 rounded-xl border border-border bg-canvas/60 p-3">
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
            <div>
              <dt className="text-xs text-muted">Sessions</dt>
              <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                {totals.sessions}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Messages</dt>
              <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatCompact(totals.messages)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Cost</dt>
              <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatUSD(totals.costUSD)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tokens in</dt>
              <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatCompact(totals.tokensIn)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tokens out</dt>
              <dd className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatCompact(totals.tokensOut)}
              </dd>
            </div>
          </dl>
          {models.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              {models.map(([m, n]) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted"
                >
                  {shortModel(m)}
                  <span className="text-subtle">×{n}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Sessions
          <span className="ml-1.5 font-normal normal-case tracking-normal text-subtle">
            newest first
          </span>
        </h4>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions recorded.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cursor tab — surfaces the connection note (not installed / connect hook).
// ---------------------------------------------------------------------------
function CursorTab({ tool }: { tool: ApiTool }) {
  return (
    <div className="rounded-xl border border-border bg-canvas/60 p-4 text-sm text-muted">
      {tool.note ?? 'Cursor telemetry is not connected on this machine.'}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Findings list (compact) inside the drill-down
// ---------------------------------------------------------------------------
function FindingRow({ finding, onOpen }: { finding: ViewFinding; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <Badge variant={finding.severity}>{severityLabel[finding.severity]}</Badge>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{finding.title}</span>
        <span className="block truncate text-xs text-muted">{finding.control}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tabbed tools panel
// ---------------------------------------------------------------------------
function ToolTabs({ tools }: { tools: Record<string, ApiTool> }) {
  const names = Object.keys(tools)
  const [active, setActive] = useState(names[0] ?? '')
  const baseId = useId()
  if (names.length === 0) return null

  return (
    <div>
      <div
        role="tablist"
        aria-label="Assistant tools"
        className="flex gap-1 border-b border-border"
      >
        {names.map((name) => {
          const selected = name === active
          const installed = tools[name]?.installed
          return (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${baseId}-tab-${name}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${name}`}
              onClick={() => setActive(name)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                selected
                  ? 'border-primary text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {name}
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full',
                  installed ? 'bg-ok' : 'bg-subtle/50',
                )}
              />
            </button>
          )
        })}
      </div>
      {names.map((name) => {
        const tool = tools[name]
        return (
          <div
            key={name}
            role="tabpanel"
            id={`${baseId}-panel-${name}`}
            aria-labelledby={`${baseId}-tab-${name}`}
            hidden={name !== active}
            className="pt-4"
          >
            {name === active &&
              (name === 'Claude Code' ? <ClaudeCodeTab tool={tool} /> : <CursorTab tool={tool} />)}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel root
// ---------------------------------------------------------------------------
export function EmployeeDetail({
  dev,
  findings,
  onOpenFinding,
}: {
  dev: DevRow
  findings: ViewFinding[]
  onOpenFinding: (id: string) => void
}) {
  const { status, detail } = useEmployeeDetail(dev.id)
  const devFindings = findings.filter((f) => f.dev === dev.id)

  const facts: { label: string; value: string }[] = [
    { label: 'Sessions', value: String(dev.sessions) },
    { label: 'Tokens', value: formatCompact(dev.tokens) },
    { label: 'Cost (MTD)', value: formatUSD(dev.costUSD) },
    { label: 'MCP servers', value: String(dev.mcpCount) },
    { label: 'Open findings', value: String(dev.openFindings) },
    { label: 'High severity', value: String(dev.highFindings) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{dev.sublabel}</Badge>
        {dev.tools.map((t) => (
          <Badge key={t} variant="neutral">
            {t}
          </Badge>
        ))}
        <RiskBadge score={dev.riskScore} />
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {facts.map((f) => (
          <Metric key={f.label} label={f.label} value={f.value} />
        ))}
      </dl>

      {/* Tools drill-down */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Tools</h3>
        {status === 'loading' && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-canvas/60 p-4 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading session detail…
          </div>
        )}
        {status === 'live' && detail && <ToolTabs tools={detail.tools} />}
        {status === 'unavailable' && (
          <div className="rounded-xl border border-border bg-canvas/60 p-4 text-sm text-muted">
            Session-level detail streams from the in-house server. It’s unavailable right now —
            showing the summary above.
          </div>
        )}
      </div>

      {/* Findings */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Open findings
          <span className="ml-1.5 font-normal text-muted">({devFindings.length})</span>
        </h3>
        {devFindings.length > 0 ? (
          <div className="space-y-2">
            {devFindings.map((f) => (
              <FindingRow key={f.id} finding={f} onOpen={() => onOpenFinding(f.id)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok-soft p-4 text-sm text-ok">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            No open findings — this developer is clean.
          </div>
        )}
      </div>
    </div>
  )
}
