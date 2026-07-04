// SessionTranscript - the masked conversation for a single captured session, plus a
// collapsible list of the tool calls it made. Preview text may embed [thinking],
// [tool_use] and [tool_result] markers; those render as small styled chips inline.
// Everything shown here is already redacted at the capture endpoint.
import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock, Wrench } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ApiEvent, ApiSessionToolCall } from '../../lib/api'

const MARKERS = ['[thinking]', '[tool_use]', '[tool_result]'] as const
type Marker = (typeof MARKERS)[number]

const MARKER_STYLE: Record<Marker, string> = {
  '[thinking]': 'border-line bg-surface text-subtle',
  '[tool_use]': 'border-accent/30 bg-accent/10 text-accent',
  '[tool_result]': 'border-info/30 bg-info/10 text-info',
}

// Split a preview into plain text runs and the three known markers (kept as the
// delimiters, so we can re-render each one as a chip).
const MARKER_SPLIT = /(\[thinking\]|\[tool_use\]|\[tool_result\])/

function isMarker(s: string): s is Marker {
  return (MARKERS as readonly string[]).includes(s)
}

function fmtTime(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function PreviewText({ text }: { text: string }) {
  return (
    <>
      {text.split(MARKER_SPLIT).map((part, i) => {
        if (!part) return null
        if (isMarker(part)) {
          return (
            <span
              key={i}
              className={cn(
                'mr-1 inline-flex items-center rounded border px-1.5 py-px align-middle font-mono text-[0.62rem]',
                MARKER_STYLE[part],
              )}
            >
              {part.slice(1, -1)}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function EventRow({ ev }: { ev: ApiEvent }) {
  const isAsst = ev.role === 'assistant'
  return (
    <li className={cn('border-l-2 pl-3', isAsst ? 'border-accent/70' : 'border-muted/40')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            'font-mono text-[0.6rem] uppercase tracking-[0.16em]',
            isAsst ? 'text-accent' : 'text-subtle',
          )}
        >
          {ev.role}
        </span>
        {isAsst && ev.model && (
          <span className="rounded border border-line bg-surface px-1.5 py-px font-mono text-[0.6rem] text-muted">
            {ev.model}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 font-mono text-[0.62rem] text-subtle">
          {isAsst && typeof ev.out === 'number' && (
            <span className="tabular-nums text-muted">{ev.out.toLocaleString()} out</span>
          )}
          <time dateTime={ev.ts}>{fmtTime(ev.ts)}</time>
        </span>
      </div>
      {ev.textPreview && (
        <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
          <PreviewText text={ev.textPreview} />
        </p>
      )}
    </li>
  )
}

function ToolCalls({ calls }: { calls: ApiSessionToolCall[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
        )}
        <Wrench className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          Tool calls ({calls.length})
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-line px-3 py-2.5">
          {calls.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.66rem] text-paper">
                {c.name}
              </span>
              <span
                className="min-w-0 flex-1 truncate font-mono text-[0.72rem] text-muted"
                title={c.arg}
              >
                {c.arg}
              </span>
              <time dateTime={c.ts} className="shrink-0 font-mono text-[0.62rem] text-subtle">
                {fmtTime(c.ts)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SessionTranscript({
  events,
  toolCalls,
}: {
  events: ApiEvent[]
  toolCalls?: ApiSessionToolCall[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[0.72rem] text-subtle">
        <Lock className="size-3.5 shrink-0 text-accent/70" aria-hidden="true" />
        <span>Masked transcript - secrets are redacted at the endpoint before capture.</span>
      </div>

      {events.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-line bg-surface px-3 py-6 text-center text-sm text-muted">
          No captured turns for this session.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((ev, i) => (
            <EventRow key={i} ev={ev} />
          ))}
        </ul>
      )}

      {toolCalls && toolCalls.length > 0 && <ToolCalls calls={toolCalls} />}
    </div>
  )
}
