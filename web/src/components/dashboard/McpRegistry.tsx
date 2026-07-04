// MCP Registry - org-wide inventory of every MCP server configured across seats,
// aggregated from the captured `mcpServers` config. A policy allowlist splits
// approved servers from unreviewed ("shadow") ones - the extra tool-execution
// surface a CISO wants flagged. Reads GET /api/mcps; degrades gracefully.
import { AlertCircle, AlertTriangle, Loader2, Plug, RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
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
import { getMcps, type ApiMcpServer } from '../../lib/api'

function StatusPill({ status }: { status: ApiMcpServer['status'] }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Unreviewed
    </span>
  )
}

export default function McpRegistry() {
  const { status, data, refetch } = useFetch(getMcps)

  const header = (
    <PageHeader
      eyebrow="Oversight"
      title="MCP Registry"
      subtitle="Every MCP server configured across the org, checked against the approved list."
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
          Building the registry...
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
          The MCP registry is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const { servers, summary } = data

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Unique servers" value={summary.unique} icon={<Plug />} hint={`${summary.configured} configured across seats`} />
        <Stat
          label="Unreviewed"
          value={summary.unreviewed}
          icon={<ShieldAlert />}
          hint={summary.unreviewed ? 'Not on the approved list' : 'All servers approved'}
          tone={summary.unreviewed ? 'negative' : undefined}
        />
        <Stat label="Approved" value={summary.approved} icon={<ShieldCheck />} hint="On the policy allowlist" />
        <Stat label="Seats with MCP" value={summary.seatsWithMcp} icon={<Users />} hint={`of ${summary.seats} tracked`} />
      </div>

      {summary.unreviewed > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-paper">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          <p>
            <span className="font-semibold">{summary.unreviewed} unreviewed MCP server{summary.unreviewed > 1 ? 's' : ''}</span> load
            on developer machines and can execute tools with the agent's privileges. Review each one and add it to the approved list
            or have the seat remove it.
          </p>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Configured servers</CardTitle>
          <CardDescription>Approved servers are on the policy allowlist. Unreviewed servers are the shadow-MCP surface.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {servers.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No MCP servers configured on any tracked seat.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Server</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Seats</TH>
                  <TH>Used by</TH>
                </TR>
              </THead>
              <TBody>
                {servers.map((s) => (
                  <TR key={s.name}>
                    <TD className="font-mono text-[0.82rem] font-medium text-paper">{s.name}</TD>
                    <TD>
                      <StatusPill status={s.status} />
                    </TD>
                    <TD className="text-right tabular-nums text-muted">{s.seats}</TD>
                    <TD className="text-muted">{s.usedBy.join(', ')}</TD>
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
