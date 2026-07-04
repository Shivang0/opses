// Governance Posture - a per-project agent-safety grade for a CISO: an AI-readiness
// audit of every repo. Each repo is scored on secret exposure, MCP
// scope and context hygiene (from findings + captured config), graded A-F, and
// its failing checks are spelled out. Reads GET /api/posture.
import { AlertCircle, Check, Loader2, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getPosture, type ApiPostureProject } from '../../lib/api'
import { cn } from '../../lib/utils'

// Grade → color. A clean, B fine, D needs work, F failing.
const gradeMeta: Record<ApiPostureProject['grade'], { ring: string; text: string; bg: string }> = {
  A: { ring: 'border-ok/40', text: 'text-ok', bg: 'bg-ok/10' },
  B: { ring: 'border-info/40', text: 'text-info', bg: 'bg-info/10' },
  D: { ring: 'border-warn/40', text: 'text-warn', bg: 'bg-warn/10' },
  F: { ring: 'border-danger/40', text: 'text-danger', bg: 'bg-danger/10' },
}

function ProjectCard({ p }: { p: ApiPostureProject }) {
  const g = gradeMeta[p.grade]
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate font-mono text-[0.95rem]">{p.project}</CardTitle>
          <p className="mt-1 text-xs text-subtle">
            {p.seats} seat{p.seats > 1 ? 's' : ''} · {p.sessions} session{p.sessions > 1 ? 's' : ''}
          </p>
        </div>
        <span
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl border font-display text-2xl font-semibold', g.ring, g.text, g.bg)}
          aria-label={`Grade ${p.grade}`}
        >
          {p.grade}
        </span>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2.5">
          {p.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                  c.pass ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger',
                )}
              >
                {c.pass ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-paper">{c.name}</p>
                <p className="text-xs leading-snug text-muted">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default function Posture() {
  const { status, data, refetch } = useFetch(getPosture)

  const header = (
    <PageHeader
      eyebrow="Oversight"
      title="Governance Posture"
      subtitle="Every repo graded on agent-safety hygiene - secret exposure, MCP scope, context weight."
      actions={
        <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
          <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
          Refresh
        </Button>
      }
    />
  )

  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Grading repositories...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Posture data is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const { projects, summary } = data

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Repositories graded" value={summary.projects} icon={<ShieldCheck />} hint="From captured sessions" />
        <Stat
          label="At risk"
          value={summary.atRisk}
          icon={<ShieldAlert />}
          hint={summary.atRisk ? 'Grade C or below' : 'All repos passing'}
          tone={summary.atRisk ? 'negative' : undefined}
        />
        <Stat label="Average score" value={`${summary.avgScore}`} icon={<ShieldCheck />} hint="Across all repos, out of 100" />
      </div>

      {projects.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">No repositories with captured sessions yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.project} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
