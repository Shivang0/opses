// Project Detail - a single-repo drill-down that folds one repository's sessions,
// contributors, MCP exposure and context posture into one view. Reads the repo
// name from the URL query (?name=), fetches GET /api/project?name=, and degrades
// gracefully across loading / not-found / unreachable states.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CircleDollarSign,
  FileText,
  FolderGit2,
  Hash,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  buttonVariants,
} from '../ui'
import { getProject, type ApiProjectDetail } from '../../lib/api'
import { shortModel } from './meta'
import { formatCompact, formatUSD } from '../../lib/utils'

// A 404 means the repo has no captured sessions (a real "not found"); any other
// throw is an unreachable/failed server. The api client throws Error messages of
// the form "...-> HTTP <status>", so the status is recoverable from the message.
type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ApiProjectDetail }
  | { status: 'notfound' }
  | { status: 'error' }

export default function ProjectDetail() {
  const [params] = useSearchParams()
  const name = params.get('name')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!name) return
    let cancelled = false
    setState({ status: 'loading' })
    getProject(name)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : ''
        setState({ status: msg.includes('404') ? 'notfound' : 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [name, reloadKey])

  // No repo selected - gentle empty state with a way back to the roster.
  if (!name) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Projects" title="Project detail" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
              <FolderGit2 className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-base text-paper">No project selected</p>
              <p className="text-sm text-muted">
                Pick a repository from the projects list to see its sessions, contributors and exposure.
              </p>
            </div>
            <Link to="/dashboard/projects" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to projects
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const header = (
    <PageHeader
      eyebrow="Projects"
      title={name}
      actions={
        <Link to="/dashboard/projects" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to projects
        </Link>
      }
    />
  )

  if (state.status === 'loading') {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading {name}...
        </div>
      </div>
    )
  }

  if (state.status === 'notfound') {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          <p>
            No project named <span className="font-mono text-paper">{name}</span> was found. It may have no captured
            sessions yet, or the name is misspelled.
          </p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
            Project detail is unavailable right now. The in-house server could not be reached.
          </span>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const d = state.data
  const totalTokens = d.totals.tokensIn + d.totals.tokensOut
  const maxModelSessions = d.models.reduce((m, r) => Math.max(m, r.sessions), 0)
  // Newest first - ISO timestamps sort lexicographically.
  const sessions = [...d.sessions].sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''))

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Sessions"
          value={d.totals.sessions}
          icon={<Activity />}
          hint={`${d.contributors.length} contributor${d.contributors.length === 1 ? '' : 's'}`}
        />
        <Stat label="Est. cost" value={formatUSD(d.totals.costUSD)} icon={<CircleDollarSign />} hint="Across captured sessions" />
        <Stat
          label="Tokens"
          value={formatCompact(totalTokens)}
          icon={<Hash />}
          hint={`${formatCompact(d.totals.tokensIn)} in / ${formatCompact(d.totals.tokensOut)} out`}
        />
        <Stat
          label="Secret leaks"
          value={d.totals.leaks}
          icon={<KeyRound />}
          hint={d.totals.leaks > 0 ? 'Found in session transcripts' : 'None detected'}
          tone={d.totals.leaks > 0 ? 'negative' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Governance</CardTitle>
            <CardDescription>Who touches this repo, the tool surface it exposes, and its context posture.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <h3 className="mono-eyebrow mb-3 flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                Contributors
              </h3>
              {d.contributors.length === 0 ? (
                <p className="text-sm text-subtle">None on record.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {d.contributors.map((c) => (
                    <span key={c} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs text-paper">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mono-eyebrow mb-3 flex items-center gap-1.5">
                <Plug className="size-3.5" aria-hidden="true" />
                MCP exposure
              </h3>
              {d.mcp.all.length === 0 ? (
                <p className="text-sm text-subtle">No MCP servers configured.</p>
              ) : (
                <>
                  <p className="font-mono text-sm text-paper">
                    {d.mcp.all.length} server{d.mcp.all.length === 1 ? '' : 's'} configured
                  </p>
                  {d.mcp.shadow.length > 0 && (
                    <>
                      <p className="mt-0.5 font-mono text-xs text-warn">{d.mcp.shadow.length} unreviewed</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.mcp.shadow.map((m) => (
                          <span
                            key={m}
                            className="rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[11px] text-warn"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div>
              <h3 className="mono-eyebrow mb-3 flex items-center gap-1.5">
                <FileText className="size-3.5" aria-hidden="true" />
                Context posture
              </h3>
              {d.contextBloat ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  Context bloat
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Within budget
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model mix</CardTitle>
            <CardDescription>Sessions per model across this repo.</CardDescription>
          </CardHeader>
          <CardContent>
            {d.models.length === 0 ? (
              <p className="text-sm text-subtle">No model usage recorded.</p>
            ) : (
              <ul className="space-y-3">
                {d.models.map((m) => {
                  const pct = maxModelSessions > 0 ? Math.max(4, (m.sessions / maxModelSessions) * 100) : 0
                  return (
                    <li key={m.model}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-xs text-paper">{shortModel(m.model)}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-subtle">{m.sessions}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {d.sessions.length} session{d.sessions.length === 1 ? '' : 's'} captured, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {sessions.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No sessions captured for this project.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Seat</TH>
                  <TH>Tool</TH>
                  <TH>Model</TH>
                  <TH className="text-right">Messages</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Leaks</TH>
                  <TH className="text-right">Ended</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap font-medium text-paper">{s.seat}</TD>
                    <TD className="text-muted">{s.tool}</TD>
                    <TD className="font-mono text-[0.82rem] text-muted">{shortModel(s.model)}</TD>
                    <TD className="text-right font-mono tabular-nums text-paper">{s.messages}</TD>
                    <TD className="text-right font-mono tabular-nums text-paper">{formatCompact(s.tokensIn + s.tokensOut)}</TD>
                    <TD className="text-right font-mono tabular-nums text-paper">{formatUSD(s.costUSD)}</TD>
                    <TD className="text-right font-mono tabular-nums">
                      {s.leaks > 0 ? (
                        <span className="text-danger">{s.leaks}</span>
                      ) : (
                        <span className="text-subtle">0</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-right text-muted">{s.endedAt ? s.endedAt.slice(0, 10) : '-'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
