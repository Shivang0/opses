import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  Check,
  Copy,
  Database,
  Loader2,
  Lock,
  RefreshCw,
  Server,
  Share2,
  Users,
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
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { fmtDateTime } from './meta'
import { useFetch } from '../../lib/useFetch'
import { getRelay, type ApiRelayContext, type ApiRelayMember } from '../../lib/api'
import { formatCompact } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Relay - share masked AI session context across the team over a local,
// in-house MCP server. Nothing leaves the building: the relay runs on the same
// network and only ever holds redacted context. This view is the MCP
// integration surface - live server status, the endpoint + protocol version,
// the contexts that have been shared, and who on the team can see them.
// ---------------------------------------------------------------------------

/** Up to two uppercase initials from a display name, for avatar chips. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0][0] ?? ''
  const last = parts[parts.length - 1][0] ?? ''
  return (first + last).toUpperCase()
}

// ---------------------------------------------------------------------------
// Member avatar stack - overlapping initials circles with a names tooltip.
// ---------------------------------------------------------------------------
function MemberAvatars({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-subtle">-</span>
  const shown = names.slice(0, 4)
  const extra = names.length - shown.length
  return (
    <span
      role="img"
      aria-label={`${names.length} member${names.length === 1 ? '' : 's'}: ${names.join(', ')}`}
      className="flex items-center"
    >
      <span className="flex -space-x-1.5">
        {shown.map((n) => (
          <span
            key={n}
            title={n}
            className="inline-flex size-6 items-center justify-center rounded-full border border-line bg-surface-2 font-mono text-[10px] font-medium text-paper ring-2 ring-surface"
          >
            {initials(n)}
          </span>
        ))}
      </span>
      {extra > 0 && <span className="ml-1.5 font-mono text-xs tabular-nums text-subtle">+{extra}</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Endpoint chip - a selectable mono code block with a one-tap copy button.
// ---------------------------------------------------------------------------
function EndpointChip({ endpoint }: { endpoint: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (e.g. an insecure context) - the text stays selectable.
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink px-2.5 py-1.5">
      <code className="select-all font-mono text-xs text-paper">{endpoint}</code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? 'Endpoint copied' : 'Copy endpoint'}
        className="inline-flex size-6 items-center justify-center rounded text-subtle transition-colors hover:bg-surface-2 hover:text-paper"
      >
        {copied ? (
          <Check className="size-3.5 text-ok" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status banner - live relay state, server identity, endpoint + protocol, and
// the standing in-house guarantee.
// ---------------------------------------------------------------------------
function StatusBanner({
  status,
  server,
  endpoint,
  protocol,
}: {
  status: string
  server: string
  endpoint: string
  protocol: string
}) {
  return (
    <Card>
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4">
          {/* Live status + protocol version */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              title={`Relay server is ${status}`}
              className="inline-flex items-center gap-2 rounded-full border border-ok/25 bg-ok/15 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-ok"
            >
              <span aria-hidden="true" className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
                <span className="relative inline-flex size-2 rounded-full bg-ok" />
              </span>
              {status}
            </span>
            <Badge variant="info">{protocol}</Badge>
          </div>

          {/* Server identity */}
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-accent"
            >
              <Server className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-medium text-paper">{server}</h2>
              <p className="text-xs text-subtle">Local Model Context Protocol relay</p>
            </div>
          </div>

          {/* Copyable endpoint */}
          <div className="space-y-1.5">
            <p className="mono-eyebrow">Endpoint</p>
            <EndpointChip endpoint={endpoint} />
          </div>
        </div>

        {/* Standing in-house guarantee */}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-muted lg:self-center">
          <Lock className="size-4 shrink-0 text-accent" aria-hidden="true" />
          In-house - context never leaves the building
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shared contexts - table of published contexts, most recently updated first.
// ---------------------------------------------------------------------------
function SharedContexts({ contexts }: { contexts: ApiRelayContext[] }) {
  const rows = [...contexts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (rows.length === 0) {
    return (
      <p className="p-6 pt-0 text-sm text-muted">
        No shared contexts yet. Publish one from your editor to share it with the team.
      </p>
    )
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Context</TH>
          <TH>Project</TH>
          <TH className="text-right">Sessions</TH>
          <TH className="text-right">Tokens</TH>
          <TH>Shared by</TH>
          <TH>Members</TH>
          <TH className="text-right">Updated</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((c) => (
          <TR key={c.id}>
            <TD className="font-medium text-paper">{c.name}</TD>
            <TD className="whitespace-nowrap">
              <Badge variant="neutral">{c.project}</Badge>
            </TD>
            <TD className="text-right font-mono tabular-nums text-paper">{c.sessions}</TD>
            <TD className="text-right font-mono tabular-nums text-paper">{formatCompact(c.tokens)}</TD>
            <TD className="whitespace-nowrap text-paper">{c.sharedBy}</TD>
            <TD>
              <MemberAvatars names={c.members} />
            </TD>
            <TD className="whitespace-nowrap text-right text-muted">{fmtDateTime(c.updatedAt)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Team members - tiles with an initials avatar, role, and context reach.
// ---------------------------------------------------------------------------
function TeamMembers({ members }: { members: ApiRelayMember[] }) {
  const rows = [...members].sort((a, b) => b.contexts - a.contexts || a.name.localeCompare(b.name))
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No team members are connected to the relay yet.</p>
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-mono text-sm font-medium text-paper"
          >
            {initials(m.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-paper">{m.name}</p>
            <div className="mt-1">
              <Badge variant="neutral">{m.role}</Badge>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-base font-semibold tabular-nums text-paper">{m.contexts}</p>
            <p className="mono-eyebrow">Context{m.contexts === 1 ? '' : 's'}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Relay() {
  const { status, data, refetch } = useFetch(getRelay)

  // First load, nothing to show yet.
  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Relay"
          subtitle="Share masked session context across your team over a local MCP server."
        />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading relay...
        </div>
      </div>
    )
  }

  // Never reached the server.
  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Relay"
          subtitle="Share masked session context across your team over a local MCP server."
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          The relay is unavailable right now. The in-house MCP server could not be reached.
        </div>
      </div>
    )
  }

  const sessionsShared = data.sharedContexts.reduce((sum, c) => sum + c.sessions, 0)
  const tokensShared = data.sharedContexts.reduce((sum, c) => sum + c.tokens, 0)
  const projectCount = new Set(data.sharedContexts.map((c) => c.project)).size
  const roleCount = new Set(data.members.map((m) => m.role)).size

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Relay"
        subtitle="Share masked session context across your team over a local MCP server."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
            <RefreshCw
              className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      <StatusBanner
        status={data.status}
        server={data.server}
        endpoint={data.endpoint}
        protocol={data.protocol}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Shared contexts"
          value={data.sharedContexts.length}
          icon={<Share2 />}
          hint={`${projectCount} project${projectCount === 1 ? '' : 's'}`}
        />
        <Stat
          label="Team members"
          value={data.members.length}
          icon={<Users />}
          hint={`${roleCount} role${roleCount === 1 ? '' : 's'}`}
        />
        <Stat
          label="Sessions shared"
          value={sessionsShared}
          icon={<Activity />}
          hint={`across ${data.sharedContexts.length} context${
            data.sharedContexts.length === 1 ? '' : 's'
          }`}
        />
        <Stat
          label="Tokens shared"
          value={formatCompact(tokensShared)}
          icon={<Database />}
          hint="Masked before sharing"
        />
      </div>

      {/* Shared contexts */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Shared contexts</CardTitle>
          <CardDescription>
            Masked session context published to the team relay, most recently updated first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SharedContexts contexts={data.sharedContexts} />
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            Everyone connected to this relay and how many contexts they can see.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembers members={data.members} />
        </CardContent>
      </Card>
    </div>
  )
}
