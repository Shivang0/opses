// Compliance console - controls mapped to live findings across three governance
// frameworks (EU AI Act, ISO/IEC 42001, NIST AI RMF), scored into an overall
// posture and narrated on-device by local Gemma. Everything here is driven by the
// shared engine in ../../lib/compliance; findings come from the live OPSES feed
// (useOpses) and analytics is an optional pass-through that enriches the prompts.
// The posture assessment and every control card run their own independent Gemma
// call, each degrading gracefully to a templated fallback when Gemma is offline.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Eyebrow,
  PageHeader,
} from '../ui'
import { ControlStatusBadge, ProgressMeter } from './indicators'
import { useOpses, type OrgView, type ViewFinding } from '../../lib/useOpses'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type ApiAnalytics, type GemmaResult } from '../../lib/api'
import {
  assessControl,
  evaluateControls,
  FRAMEWORKS,
  posture,
  summarizePosture,
  type ControlEval,
} from '../../lib/compliance'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// On-device Gemma call - the same idle/loading/done/error machine the employee
// drill-down uses, shared by the posture assessment and every control card. The
// result block (and its "generated on-device" indicator) is rendered identically
// wherever a local model answer is surfaced.
// ---------------------------------------------------------------------------
type GemmaState = {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: GemmaResult | null
}

function GemmaOutput({ state }: { state: GemmaState }) {
  if (state.status === 'error') {
    return (
      <p className="mt-3 text-sm text-warn">
        The local model could not be reached. Make sure the Gemma server is running, then try again.
      </p>
    )
  }
  if (state.status === 'done' && state.result) {
    return (
      <div className="mt-3 rounded-lg border border-line bg-ink px-3 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">{state.result.text}</p>
        {state.result.source === 'gemma' && (
          <p className="mt-2.5 flex items-center gap-1.5 font-mono text-xs text-subtle">
            <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ok" />
            Generated on-device by local Gemma
          </p>
        )}
      </div>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Posture summary - overall score + meter, the on-track / monitored / at-risk
// tally, and a whole-org assessment the CISO can run on-device.
// ---------------------------------------------------------------------------
const POSTURE_COUNTS = [
  { key: 'ok', label: 'On track', dot: 'bg-ok' },
  { key: 'monitored', label: 'Monitored', dot: 'bg-info' },
  { key: 'atRisk', label: 'At risk', dot: 'bg-danger' },
] as const

function PostureCard({
  org,
  findings,
  evals,
  analytics,
}: {
  org: OrgView
  findings: ViewFinding[]
  evals: ControlEval[]
  analytics: ApiAnalytics | null
}) {
  const p = posture(evals)
  const [state, setState] = useState<GemmaState>({ status: 'idle', result: null })

  const run = () => {
    setState({ status: 'loading', result: null })
    summarizePosture(org, findings, evals, analytics)
      .then((result) => setState({ status: 'done', result }))
      .catch(() => setState({ status: 'error', result: null }))
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="max-w-md">
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-paper">Overall compliance posture</span>
              <span className="font-mono text-sm text-paper">
                {p.score}
                <span className="text-muted">/100</span>
              </span>
            </div>
            <ProgressMeter value={p.score} label="Overall compliance posture" />
            <p className="mt-2 text-xs text-muted">
              {p.atRisk} control{p.atRisk === 1 ? '' : 's'} at risk across {p.total} mapped controls -
              target 90+
            </p>
          </div>
          <dl className="flex gap-6 sm:gap-8">
            {POSTURE_COUNTS.map((c) => (
              <div key={c.key}>
                <dt className="mono-eyebrow flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn('size-1.5 rounded-full', c.dot)} />
                  {c.label}
                </dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-paper">
                  {p[c.key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Whole-org assessment, evaluated on-device */}
        <div className="mt-6 border-t border-line pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-paper">
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
                Posture assessment
              </h3>
              <p className="mt-1 text-xs text-muted">
                Have the local model read every finding and weigh the overall posture. Nothing leaves
                the building.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={run}
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Assessing
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  {state.status === 'done' ? 'Re-assess posture' : 'Assess posture with Gemma'}
                </>
              )}
            </Button>
          </div>
          <GemmaOutput state={state} />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Control card - one mapped control, its live status + evidence, and an
// on-device "generate evidence" narrative. Each card owns its Gemma state so
// the calls run independently.
// ---------------------------------------------------------------------------
function ControlCard({ evalItem, org }: { evalItem: ControlEval; org: OrgView }) {
  const { control, findings, status } = evalItem
  const [state, setState] = useState<GemmaState>({ status: 'idle', result: null })

  const run = () => {
    setState({ status: 'loading', result: null })
    assessControl(evalItem, org)
      .then((result) => setState({ status: 'done', result }))
      .catch(() => setState({ status: 'error', result: null }))
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-1">
          <Eyebrow>
            {control.framework} {control.ref}
          </Eyebrow>
          <CardTitle>{control.title}</CardTitle>
        </div>
        <ControlStatusBadge status={status} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted">{control.description}</p>

        <div className="mt-auto border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {control.positive && status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-ok">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Satisfied by continuous logging
              </span>
            ) : findings.length > 0 ? (
              <Link
                to="/dashboard/findings"
                className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-accent transition-colors hover:text-paper"
              >
                {findings.length} open {findings.length === 1 ? 'finding' : 'findings'}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="text-sm text-muted">No findings</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={run}
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  {state.status === 'done' ? 'Regenerate' : 'Generate evidence'}
                </>
              )}
            </Button>
          </div>
          <GemmaOutput state={state} />
        </div>
      </CardContent>
    </Card>
  )
}

/** One-line status roll-up for a framework heading (worst status wins). */
function frameworkSummary(items: ControlEval[]): { label: string; tone: string } {
  const atRisk = items.filter((e) => e.status === 'at_risk').length
  if (atRisk > 0) return { label: `${atRisk} at risk`, tone: 'text-danger' }
  const monitored = items.filter((e) => e.status === 'monitored').length
  if (monitored > 0) return { label: `${monitored} monitored`, tone: 'text-info' }
  return { label: 'All on track', tone: 'text-ok' }
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Compliance() {
  const { org, findings } = useOpses()
  // Analytics is optional context for the prompts - degrade quietly if offline.
  const { data: analytics } = useFetch(getAnalytics)
  const evals = useMemo(() => evaluateControls(findings), [findings])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Compliance"
        subtitle="Controls mapped to live findings across EU AI Act, ISO 42001, and NIST AI RMF."
        actions={
          <Link to="/dashboard/reports" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            <FileText className="size-4" aria-hidden="true" />
            Generate full report
          </Link>
        }
      />

      <PostureCard org={org} findings={findings} evals={evals} analytics={analytics} />

      {FRAMEWORKS.map((framework) => {
        const items = evals.filter((e) => e.control.framework === framework.name)
        const summary = frameworkSummary(items)
        return (
          <section key={framework.name} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <div>
                <h2 className="font-display text-lg text-paper">{framework.name}</h2>
                <p className="mt-1 text-sm text-muted">{framework.blurb}</p>
              </div>
              <span className={cn('shrink-0 font-mono text-xs', summary.tone)}>{summary.label}</span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {items.map((evalItem) => (
                <ControlCard key={evalItem.control.id} evalItem={evalItem} org={org} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
