// Context Files - the agent-instruction files (CLAUDE.md and friends) loaded on
// every session across the org, their token weight, and the hooks configured per
// seat. Context is the policy surface: bloat wastes budget every turn and drift
// means seats run on different rules. Reads GET /api/context-files.
import { AlertCircle, AlertTriangle, FileText, Loader2, RefreshCw, Terminal, Gauge } from 'lucide-react'
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
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getContextFiles } from '../../lib/api'

const fmt = (n: number) => n.toLocaleString('en-US')

export default function ContextFiles() {
  const { status, data, refetch } = useFetch(getContextFiles)

  const header = (
    <PageHeader
      eyebrow="Oversight"
      title="Context Files"
      subtitle="Agent-instruction files loaded on every session - the policy surface, weighed and flagged."
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
          Scanning context files...
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
          The context inventory is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const { files, hooks, summary } = data

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Context files" value={summary.files} icon={<FileText />} hint={`across ${summary.seats} seats`} />
        <Stat label="Tokens / session" value={fmt(summary.totalTokens)} icon={<Gauge />} hint="Loaded before the first prompt" />
        <Stat
          label="Bloated"
          value={summary.bloated}
          icon={<AlertTriangle />}
          hint={summary.bloated ? 'Over 2,000 tokens' : 'All within budget'}
          tone={summary.bloated ? 'negative' : undefined}
        />
        <Stat label="Hooks" value={summary.hooks} icon={<Terminal />} hint="Distinct shell hooks configured" />
      </div>

      {summary.bloated > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-paper">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          <p>
            <span className="font-semibold">{summary.bloated} bloated context file{summary.bloated > 1 ? 's' : ''}</span> reload
            the same oversized instructions on every session. A trimmed rewrite keeps the operative rules at a fraction of the
            per-turn token cost - draft one from the Findings view with on-device Gemma.
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Files loaded every session</CardTitle>
          <CardDescription>Sorted by weight. Anything over ~2,000 tokens is flagged for a trim.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {files.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No context files detected on any tracked seat.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Seat</TH>
                  <TH>File</TH>
                  <TH>Scope</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {files.map((f, i) => (
                  <TR key={`${f.seat}-${f.file}-${i}`}>
                    <TD className="font-medium text-paper">{f.seat}</TD>
                    <TD className="font-mono text-[0.82rem] text-muted">{f.file}</TD>
                    <TD className="text-muted">{f.scope}</TD>
                    <TD className="text-right tabular-nums text-muted">~{fmt(f.tokens)}</TD>
                    <TD>
                      {f.status === 'bloated' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Bloated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
                          Within budget
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {hooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configured hooks</CardTitle>
            <CardDescription>Shell hooks that fire around agent turns - each one runs with the developer's privileges.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {hooks.map((h) => (
                <span
                  key={h.name}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted"
                >
                  {h.name}
                  <span className="tabular-nums text-subtle">{h.seats}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
