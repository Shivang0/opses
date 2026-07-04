// Connections - which telemetry signals OPSES can capture from each supported
// editor. Reads GET /api/connections and renders a capability matrix (Messages,
// Tools, Models, Tokens) plus the scan note. Degrades gracefully when the
// in-house server is unreachable, mirroring Analytics.
import type { ComponentType } from 'react'
import { AlertCircle, AlertTriangle, Check, Info, Loader2, Minus, Plug, Radio, RefreshCw, ShieldCheck } from 'lucide-react'
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
import { getConnections, type ApiCapability, type ApiConnectionRow } from '../../lib/api'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// The four telemetry signals OPSES can read from an editor, in column order.
// The key indexes straight into an ApiConnectionRow.
// ---------------------------------------------------------------------------
const SIGNALS: { key: 'msgs' | 'tools' | 'models' | 'tokens'; label: string }[] = [
  { key: 'msgs', label: 'Messages' },
  { key: 'tools', label: 'Tools' },
  { key: 'models', label: 'Models' },
  { key: 'tokens', label: 'Tokens' },
]

// Per-capability rendering: icon, color, and screen-reader status.
const capMeta: Record<
  ApiCapability,
  { Icon: ComponentType<{ className?: string }>; className: string; label: string }
> = {
  yes: { Icon: Check, className: 'text-ok', label: 'Captured' },
  no: { Icon: Minus, className: 'text-subtle', label: 'Not captured' },
  warn: { Icon: AlertTriangle, className: 'text-warn', label: 'Only while the editor is running' },
}

const isFullyInstrumented = (r: ApiConnectionRow): boolean =>
  r.msgs === 'yes' && r.tools === 'yes' && r.models === 'yes' && r.tokens === 'yes'

// ---------------------------------------------------------------------------
// Capability cell - centered icon + color with an sr-only status for the pair,
// so screen readers announce "Cursor Tokens: Captured" rather than a bare icon.
// ---------------------------------------------------------------------------
function CapabilityCell({ cap, editor, signal }: { cap: ApiCapability; editor: string; signal: string }) {
  const { Icon, className, label } = capMeta[cap]
  return (
    <TD className="text-center">
      <span className="inline-flex items-center justify-center">
        <Icon className={cn('size-4', className)} aria-hidden="true" />
        <span className="sr-only">{`${editor} ${signal}: ${label}`}</span>
      </span>
    </TD>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Connections() {
  const { status, data, refetch } = useFetch(getConnections)

  // First load, nothing to show yet.
  if (status === 'loading' && !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Console"
          title="Connections"
          subtitle="Supported editors and the telemetry OPSES can capture from each."
        />
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading connections...
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
          title="Connections"
          subtitle="Supported editors and the telemetry OPSES can capture from each."
          actions={
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Connection status is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  const editors = data.editors
  const fully = editors.filter(isFullyInstrumented).length
  const partial = editors.length - fully

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Console"
        title="Connections"
        subtitle="Supported editors and the telemetry OPSES can capture from each."
        actions={
          <Button variant="secondary" size="sm" onClick={refetch} disabled={status === 'loading'}>
            <RefreshCw className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Supported editors" value={editors.length} icon={<Plug />} hint="Detected on this network" />
        <Stat label="Fully instrumented" value={fully} icon={<ShieldCheck />} hint="All four signals captured" />
        <Stat
          label="Partial"
          value={partial}
          icon={<AlertTriangle />}
          hint={partial === 0 ? 'Full coverage' : 'Missing one or more signals'}
        />
        <Stat label="Signals tracked" value={4} icon={<Radio />} hint="Messages, Tools, Models, Tokens" />
      </div>

      {/* Capability matrix */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Capability matrix</CardTitle>
          <CardDescription>Which telemetry signals OPSES can read from each supported editor.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <TR>
                <TH>Editor</TH>
                {SIGNALS.map((s) => (
                  <TH key={s.key} className="text-center">
                    {s.label}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {editors.map((row) => (
                <TR key={row.editor}>
                  <TD className="font-medium text-paper">{row.editor}</TD>
                  {SIGNALS.map((s) => (
                    <CapabilityCell key={s.key} cap={row[s.key]} editor={row.editor} signal={s.label} />
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scan note */}
      <div className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
        <p>{data.note}</p>
      </div>
    </div>
  )
}
