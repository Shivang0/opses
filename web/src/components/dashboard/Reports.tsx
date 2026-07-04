// Reports - the OPSES flagship "compliance reports written by the offline model"
// view. Two tabs: a framework-mapped compliance report the CISO generates on
// demand (executive summary + a per-control narrative, each written on-device by
// local Gemma, exportable to Markdown or print), and a weekly leadership digest.
//
// Every narrative funnels through the shared compliance engine (../../lib/
// compliance), which grounds each prompt in the same live findings the rest of
// the console renders. Nothing leaves the building - the green-dot indicator marks
// text the local model produced, and calls degrade gracefully when it is offline.
import { useId, useMemo, useState } from 'react'
import {
  CalendarClock,
  Check,
  Download,
  FileText,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { ControlStatusBadge, ProgressMeter } from './indicators'
import { controlStatusMeta, severityLabel, severityRank } from './meta'
import { cn } from '../../lib/utils'
import { useOpses, type ViewFinding } from '../../lib/useOpses'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type GemmaResult } from '../../lib/api'
import {
  FRAMEWORKS,
  assessControl,
  evaluateControls,
  generateDigest,
  posture,
  summarizePosture,
  type ControlEval,
  type FrameworkName,
  type Posture,
} from '../../lib/compliance'

const TENANT = 'Cerebral Valley'

const TABS = [
  { id: 'report', label: 'Compliance report', icon: FileText },
  { id: 'digest', label: 'Weekly digest', icon: CalendarClock },
] as const
type TabId = (typeof TABS)[number]['id']

// A finished report - snapshotted so it stays stable even if the framework
// selection changes afterward. Narratives are keyed by control id; a missing key
// means that control's on-device call did not return (the report never aborts).
interface ReportData {
  generatedAt: string
  frameworks: FrameworkName[]
  evals: ControlEval[]
  posture: Posture
  summary: GemmaResult | null
  narratives: Record<string, GemmaResult>
}

interface Progress {
  text: string
  detail: string
  done: number
  total: number
}

interface RegisterRow {
  finding: ViewFinding
  controls: string[]
}

// ---------------------------------------------------------------------------
// Findings register - every finding that mapped to any evaluated control, deduped
// (a finding can back several controls), most severe first.
// ---------------------------------------------------------------------------
function buildRegister(evals: ControlEval[]): RegisterRow[] {
  const byFinding = new Map<string, RegisterRow>()
  for (const ev of evals) {
    for (const f of ev.findings) {
      const ref = `${ev.control.framework} ${ev.control.ref}`
      const row = byFinding.get(f.id)
      if (row) {
        if (!row.controls.includes(ref)) row.controls.push(ref)
      } else {
        byFinding.set(f.id, { finding: f, controls: [ref] })
      }
    }
  }
  return [...byFinding.values()].sort(
    (a, b) => severityRank[b.finding.severity] - severityRank[a.finding.severity],
  )
}

// ---------------------------------------------------------------------------
// Markdown export - built from the same snapshot the document renders.
// ---------------------------------------------------------------------------
function buildMarkdown(data: ReportData): string {
  const lines: string[] = [
    '# AI Governance Compliance Report',
    '',
    `- Tenant: ${TENANT}`,
    `- Generated: ${data.generatedAt}`,
    `- Frameworks: ${data.frameworks.join(', ')}`,
    '',
    '## Executive summary',
    '',
    data.summary
      ? data.summary.text
      : 'Summary unavailable - the local model could not be reached at generation time.',
    '',
    '## Posture',
    '',
    `- Score: ${data.posture.score}/100`,
    `- On track: ${data.posture.ok}`,
    `- Monitored: ${data.posture.monitored}`,
    `- At risk: ${data.posture.atRisk}`,
    `- Controls assessed: ${data.posture.total}`,
    '',
  ]

  for (const fw of FRAMEWORKS.filter((f) => data.frameworks.includes(f.name))) {
    lines.push(`## ${fw.name}`, '', `_${fw.blurb}_`, '')
    for (const ev of data.evals.filter((e) => e.control.framework === fw.name)) {
      lines.push(
        `### ${ev.control.ref} - ${ev.control.title}`,
        '',
        `Status: ${controlStatusMeta[ev.status].label}`,
        '',
        ev.control.description,
        '',
      )
      const narrative = data.narratives[ev.control.id]
      if (narrative) lines.push(narrative.text, '')
      if (ev.findings.length > 0) {
        lines.push('Mapped findings:')
        for (const f of ev.findings) lines.push(`- [${severityLabel[f.severity]}] ${f.title}`)
        lines.push('')
      }
    }
  }

  const register = buildRegister(data.evals)
  if (register.length > 0) {
    lines.push(
      '## Findings register',
      '',
      '| Severity | Finding | Framework / control |',
      '| --- | --- | --- |',
    )
    for (const r of register) {
      lines.push(`| ${severityLabel[r.finding.severity]} | ${r.finding.title} | ${r.controls.join('; ')} |`)
    }
    lines.push('')
  }

  lines.push('---', 'Generated on-device by OPSES. No data left the building.')
  return lines.join('\n')
}

function downloadReport(data: ReportData): void {
  const md = buildMarkdown(data)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `opses-compliance-report-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Shared on-device result presentation (copies EmployeeDetail's Gemma block).
// ---------------------------------------------------------------------------
function OnDeviceNote() {
  return (
    <p className="mt-2.5 flex items-center gap-1.5 font-mono text-xs text-subtle">
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ok" />
      Generated on-device by local Gemma
    </p>
  )
}

function ResultBlock({ result }: { result: GemmaResult }) {
  return (
    <div className="rounded-lg border border-line bg-ink px-3 py-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">{result.text}</p>
      {result.source === 'gemma' && <OnDeviceNote />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posture - score meter + the three status counts.
// ---------------------------------------------------------------------------
function PostureCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <dt className="mono-eyebrow">{label}</dt>
      <dd className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', tone)}>{value}</dd>
    </div>
  )
}

function PostureBlock({ posture: p }: { posture: Posture }) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-paper">Overall posture score</span>
        <span className="font-mono text-sm text-paper">
          {p.score}
          <span className="text-muted">/100</span>
        </span>
      </div>
      <ProgressMeter value={p.score} label="Overall posture score" />
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <PostureCount label="On track" value={p.ok} tone="text-ok" />
        <PostureCount label="Monitored" value={p.monitored} tone="text-info" />
        <PostureCount label="At risk" value={p.atRisk} tone="text-danger" />
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One control - status, description, the Gemma narrative, and mapped findings.
// ---------------------------------------------------------------------------
function ControlBlock({ ev, narrative }: { ev: ControlEval; narrative?: GemmaResult }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-paper">
            <span className="font-mono text-subtle">{ev.control.ref}</span> - {ev.control.title}
          </h4>
          <p className="mt-1 text-xs text-muted">{ev.control.description}</p>
        </div>
        <ControlStatusBadge status={ev.status} />
      </div>

      {narrative && (
        <div className="mt-3">
          <ResultBlock result={narrative} />
        </div>
      )}

      {ev.findings.length > 0 && (
        <div className="mt-3">
          <p className="mono-eyebrow mb-2">Mapped findings</p>
          <ul className="space-y-1.5">
            {ev.findings.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5">
                <Badge variant={f.severity}>{severityLabel[f.severity]}</Badge>
                <span className="min-w-0 truncate text-sm text-paper">{f.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Findings register table.
// ---------------------------------------------------------------------------
function RegisterTable({ evals }: { evals: ControlEval[] }) {
  const rows = buildRegister(evals)
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/15 p-4 text-sm text-ok">
        <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
        No findings mapped to the selected controls - nothing outstanding to report.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <Table>
        <THead>
          <TR>
            <TH>Severity</TH>
            <TH>Finding</TH>
            <TH>Framework / control</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.finding.id}>
              <TD>
                <Badge variant={r.finding.severity}>{severityLabel[r.finding.severity]}</Badge>
              </TD>
              <TD className="text-paper">{r.finding.title}</TD>
              <TD className="font-mono text-xs text-subtle">{r.controls.join(', ')}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The rendered report document.
// ---------------------------------------------------------------------------
function ReportDocument({ data }: { data: ReportData }) {
  const frameworks = FRAMEWORKS.filter((f) => data.frameworks.includes(f.name))
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line bg-surface-2/40 px-6 py-5">
        <h2 className="font-display text-xl text-paper sm:text-2xl">
          AI Governance Compliance Report
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
          <div>
            <dt className="inline text-muted">Tenant: </dt>
            <dd className="inline text-paper">{TENANT}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Generated: </dt>
            <dd className="inline text-paper">{data.generatedAt}</dd>
          </div>
          <div className="min-w-0">
            <dt className="inline text-muted">Frameworks: </dt>
            <dd className="inline text-paper">{data.frameworks.join(', ')}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-8 p-6">
        <section>
          <h3 className="mono-eyebrow mb-3">Executive summary</h3>
          {data.summary ? (
            <ResultBlock result={data.summary} />
          ) : (
            <div className="rounded-lg border border-warn/25 bg-warn/10 px-3 py-3 text-sm text-warn">
              The local model could not be reached, so the executive summary is unavailable. The
              control mappings and posture below are computed on-device from live evidence.
            </div>
          )}
        </section>

        <section>
          <h3 className="mono-eyebrow mb-3">Posture</h3>
          <PostureBlock posture={data.posture} />
        </section>

        {frameworks.map((fw) => (
          <section key={fw.name}>
            <div className="mb-3 border-b border-line pb-2">
              <h3 className="font-display text-lg text-paper">{fw.name}</h3>
              <p className="text-sm text-muted">{fw.blurb}</p>
            </div>
            <div className="space-y-4">
              {data.evals
                .filter((e) => e.control.framework === fw.name)
                .map((ev) => (
                  <ControlBlock
                    key={ev.control.id}
                    ev={ev}
                    narrative={data.narratives[ev.control.id]}
                  />
                ))}
            </div>
          </section>
        ))}

        <section>
          <h3 className="mono-eyebrow mb-3">Findings register</h3>
          <RegisterTable evals={data.evals} />
        </section>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Live progress while the on-device model writes the report, control by control.
// ---------------------------------------------------------------------------
function ProgressPanel({ progress }: { progress: Progress }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-paper">
          <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
          {progress.text}
        </div>
        <div className="mt-3">
          <ProgressMeter
            value={progress.done}
            max={progress.total}
            label="Report generation progress"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-xs text-subtle">
          <span className="min-w-0 truncate">{progress.detail}</span>
          <span className="shrink-0 tabular-nums">
            {progress.done} / {progress.total}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted">
          Running entirely on-device. Local inference can take a moment per control - nothing is
          sent off the machine.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 - compliance report generator.
// ---------------------------------------------------------------------------
function ReportTab() {
  const { org, findings } = useOpses()
  const { data: analytics } = useFetch(getAnalytics)

  const [selected, setSelected] = useState<FrameworkName[]>(() => FRAMEWORKS.map((f) => f.name))
  const [report, setReport] = useState<ReportData | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const generating = progress !== null

  const toggleFramework = (name: FrameworkName) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }

  const runReport = async () => {
    // Snapshot the selection so the document is stable if it changes mid-run.
    const frameworks = FRAMEWORKS.map((f) => f.name).filter((n) => selected.includes(n))
    const evals = evaluateControls(findings, frameworks)
    if (evals.length === 0) return
    const generatedAt = new Date().toLocaleString()
    const p = posture(evals)

    setReport(null)
    setProgress({
      text: 'Writing the executive summary on-device',
      detail: 'Summarizing posture across the selected frameworks',
      done: 0,
      total: evals.length,
    })

    let summary: GemmaResult | null = null
    try {
      summary = await summarizePosture(org, findings, evals, analytics)
    } catch {
      summary = null
    }

    // One sequential on-device call per control - the local CPU handles them one
    // at a time, so we surface progress and never block on the whole batch.
    const narratives: Record<string, GemmaResult> = {}
    for (let i = 0; i < evals.length; i += 1) {
      const ev = evals[i]
      setProgress({
        text: `Assessing control ${i + 1} of ${evals.length}`,
        detail: `${ev.control.framework} ${ev.control.ref} - ${ev.control.title}`,
        done: i,
        total: evals.length,
      })
      try {
        narratives[ev.control.id] = await assessControl(ev, org)
      } catch {
        // Leave this control's narrative empty; the report still stands.
      }
    }

    setReport({ generatedAt, frameworks, evals, posture: p, summary, narratives })
    setProgress(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Framework scope</CardTitle>
          <CardDescription>
            Choose the frameworks to map controls against, then generate a report written entirely
            on-device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Frameworks to include">
            {FRAMEWORKS.map((f) => {
              const on = selected.includes(f.name)
              return (
                <button
                  key={f.name}
                  type="button"
                  aria-pressed={on}
                  disabled={generating}
                  onClick={() => toggleFramework(f.name)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                    on
                      ? 'border-accent/40 bg-accent/10 text-paper'
                      : 'border-line bg-surface text-muted hover:bg-surface-2 hover:text-paper',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border',
                      on ? 'border-accent bg-accent text-accent-fg' : 'border-line',
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  {f.name}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runReport} disabled={generating || selected.length === 0}>
              {generating ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles aria-hidden="true" />
                  {report ? 'Regenerate report' : 'Generate report'}
                </>
              )}
            </Button>
            {report && !generating && (
              <>
                <Button variant="secondary" onClick={() => downloadReport(report)}>
                  <Download aria-hidden="true" />
                  Download Markdown
                </Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {generating && progress && <ProgressPanel progress={progress} />}
      {report && !generating && <ReportDocument data={report} />}
      {!report && !generating && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] border border-dashed border-line bg-surface p-10 text-center">
          <FileText className="size-8 text-subtle" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted">
            No report yet. Pick your frameworks and generate a compliance report - the executive
            summary and every control narrative are written by the local Gemma model, on this
            machine.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 - weekly digest.
// ---------------------------------------------------------------------------
function DigestTab() {
  const { org, findings } = useOpses()
  const { data: analytics } = useFetch(getAnalytics)

  const evals = useMemo(() => evaluateControls(findings), [findings])
  const snapshot = useMemo(() => posture(evals), [evals])

  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error'
    result: GemmaResult | null
  }>({ status: 'idle', result: null })

  const runDigest = () => {
    setState({ status: 'loading', result: null })
    generateDigest(org, findings, evals, analytics, 'this week')
      .then((result) => setState({ status: 'done', result }))
      .catch(() => setState({ status: 'error', result: null }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly digest</CardTitle>
          <CardDescription>
            A short, plain-language governance digest for leadership, written on-device from this
            week&apos;s captured evidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runDigest} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Generating
              </>
            ) : (
              <>
                <Sparkles aria-hidden="true" />
                {state.result ? 'Regenerate digest' : 'Generate digest'}
              </>
            )}
          </Button>
          <p className="text-xs text-subtle">
            Scheduled nightly by the in-house agent; generate on demand here.
          </p>
        </CardContent>
      </Card>

      {state.status === 'error' && (
        <div className="rounded-[var(--radius)] border border-warn/25 bg-warn/10 p-4 text-sm text-warn">
          The local model could not be reached. Make sure the Gemma server is running, then try
          again.
        </div>
      )}

      {state.status === 'done' && state.result && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <p className="mono-eyebrow">Posture score</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-paper">
                  {snapshot.score}
                  <span className="text-base text-muted">/100</span>
                </p>
              </div>
              <div>
                <p className="mono-eyebrow">Controls at risk</p>
                <p
                  className={cn(
                    'mt-1 font-mono text-2xl font-semibold tabular-nums',
                    snapshot.atRisk > 0 ? 'text-danger' : 'text-ok',
                  )}
                >
                  {snapshot.atRisk}
                </p>
              </div>
            </div>
            <ResultBlock result={state.result} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Reports() {
  const [tab, setTab] = useState<TabId>('report')
  const baseId = useId()

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Reports"
        subtitle="Framework-mapped compliance reports, written on-device by Gemma."
      />

      <div role="tablist" aria-label="Reports" className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const selected = t.id === tab
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-accent text-paper'
                  : 'border-transparent text-muted hover:text-paper',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${baseId}-panel-${t.id}`}
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={t.id !== tab}
        >
          {t.id === tab && (t.id === 'report' ? <ReportTab /> : <DigestTab />)}
        </div>
      ))}
    </div>
  )
}
