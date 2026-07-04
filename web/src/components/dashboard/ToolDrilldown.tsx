// Tool drill-down - the org's agent tool-call activity as an inspectable audit
// trail. Tools are ranked by call volume; selecting one reveals its individual
// invocations (which seat, which repo, and the masked target it acted on). The
// targets are masked at the capture endpoint, so this records the action, not
// the content. Reads GET /api/tools; degrades gracefully. Renders inside the
// Deep Analysis page, so it carries no PageHeader of its own.
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, EyeOff, Loader2, Wrench } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getTools, type ApiToolRow } from '../../lib/api'
import { cn } from '../../lib/utils'

// Compact, faint timestamp for the invocation log. Falls back to the raw string
// if the captured value is not a parseable date.
function formatTs(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// One ranked tool: a full-width button whose amber fill is proportional to its
// share of the busiest tool's call count. The whole row selects the tool.
function ToolBar({
  tool,
  max,
  selected,
  onSelect,
}: {
  tool: ApiToolRow
  max: number
  selected: boolean
  onSelect: (name: string) => void
}) {
  const pct = max > 0 && tool.count > 0 ? Math.max((tool.count / max) * 100, 3) : 0
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.name)}
      aria-pressed={selected}
      className={cn(
        'group block w-full rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-accent/50 bg-accent/[0.06]'
          : 'border-transparent hover:border-line hover:bg-accent/[0.035]',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            'truncate font-mono text-[0.82rem] font-medium transition-colors',
            selected ? 'text-accent' : 'text-paper group-hover:text-accent',
          )}
        >
          {tool.name}
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs text-subtle">
          <span className="font-mono text-sm tabular-nums text-paper">{tool.count.toLocaleString()}</span>
          {' · '}
          {tool.seats} seat{tool.seats === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent/40" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
    </button>
  )
}

export default function ToolDrilldown() {
  const { status, data } = useFetch(getTools)
  const [selected, setSelected] = useState<string | null>(null)

  const tools = data?.tools ?? null

  // Default the selection to the busiest (first) tool once data lands, and keep
  // it valid across refetches when the selected tool is still present.
  useEffect(() => {
    if (!tools || tools.length === 0) return
    setSelected((cur) => (cur && tools.some((t) => t.name === cur) ? cur : tools[0].name))
  }, [tools])

  const max = useMemo(
    () => (tools && tools.length > 0 ? Math.max(...tools.map((t) => t.count)) : 0),
    [tools],
  )

  const caption = data
    ? `${data.summary.total.toLocaleString()} tool calls across ${data.summary.unique} distinct tools`
    : 'Every agent tool call, ranked and inspectable.'

  const heading = (
    <div>
      <div className="flex items-center gap-2.5">
        <Wrench className="size-4 shrink-0 text-accent" aria-hidden="true" />
        <h2 className="font-display text-xl font-medium leading-tight text-paper">Tool activity</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">{caption}</p>
    </div>
  )

  if (status === 'loading' && !data) {
    return (
      <div className="space-y-6">
        {heading}
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Reading the tool-call log...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {heading}
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
          Tool activity is unavailable right now. The in-house server could not be reached.
        </div>
      </div>
    )
  }

  if (!tools || tools.length === 0) {
    return (
      <div className="space-y-6">
        {heading}
        <div className="rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          No tool calls have been captured yet.
        </div>
      </div>
    )
  }

  const active = tools.find((t) => t.name === selected) ?? tools[0]

  return (
    <div className="space-y-6">
      {heading}

      <div className="grid gap-4 md:grid-cols-5">
        {/* Ranked tools - horizontal bars, each row selects the tool. */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tools</CardTitle>
            <CardDescription>Ranked by call volume. Select one to inspect its invocations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="opses-scroll -mr-2 max-h-[520px] space-y-1 overflow-y-auto pr-2">
              {tools.map((t) => (
                <ToolBar
                  key={t.name}
                  tool={t}
                  max={max}
                  selected={active.name === t.name}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Invocations for the selected tool - the masked audit trail. */}
        <Card className="overflow-hidden md:col-span-3">
          <CardHeader>
            <CardTitle>Invocations</CardTitle>
            <CardDescription>
              <span className="font-mono text-paper">{active.name}</span> · {active.count.toLocaleString()} call
              {active.count === 1 ? '' : 's'} across {active.seats} seat{active.seats === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <p className="mb-3 flex items-center gap-1.5 px-6 text-xs text-subtle">
              <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
              Targets are masked at the endpoint - the action is captured, not the content.
            </p>
            {active.samples.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted">No individual invocations were captured for this tool.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Seat</TH>
                    <TH>Project</TH>
                    <TH className="w-full">Target</TH>
                    <TH className="text-right">Time</TH>
                  </TR>
                </THead>
                <TBody>
                  {active.samples.map((s, i) => (
                    <TR key={`${s.seat}-${s.ts}-${i}`}>
                      <TD className="whitespace-nowrap font-medium text-paper">{s.seat}</TD>
                      <TD className="whitespace-nowrap font-mono text-[0.8rem] text-muted">{s.project}</TD>
                      <TD className="font-mono text-[0.8rem] text-muted">
                        <span className="line-clamp-2 break-all" title={s.arg}>
                          {s.arg}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap text-right font-mono text-xs tabular-nums text-subtle">
                        {formatTs(s.ts)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
