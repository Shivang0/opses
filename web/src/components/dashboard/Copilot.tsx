// Compliance copilot - an ask-anything box for the org's AI-governance posture,
// answered on-device by the local Gemma model and grounded in OPSES's real
// findings, control posture, and usage. The question, the evidence it is grounded
// in, and the answer all stay on the machine - nothing leaves the building.
//
// The brain lives in ../../lib/compliance: evaluateControls() derives the control
// posture from live findings, and askCompliance() assembles the grounded prompt
// and funnels it through the one shared on-device model call.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Loader2, Lock, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { Button, Card, PageHeader } from '../ui'
import { useOpses } from '../../lib/useOpses'
import { useFetch } from '../../lib/useFetch'
import { getAnalytics, type GemmaResult } from '../../lib/api'
import { askCompliance, evaluateControls, SUGGESTED_QUESTIONS } from '../../lib/compliance'

// A single question/answer exchange. `result` stays null until the on-device call
// settles; `status` tracks the in-flight -> done/error lifecycle for that turn.
interface Turn {
  id: number
  question: string
  result: GemmaResult | null
  status: 'loading' | 'done' | 'error'
}

// ---------------------------------------------------------------------------
// In-house banner - echoes the DashboardLayout lock + live-pulse styling so the
// on-device guarantee is unmistakable on the copilot surface.
// ---------------------------------------------------------------------------
function InHouseBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <Lock className="size-4 shrink-0 text-accent" aria-hidden="true" />
        Runs on the local model - your findings and prompts never leave the building.
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/15 px-2.5 py-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.1em] text-ok">
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok/60" />
          <span className="relative inline-flex size-2 rounded-full bg-ok" />
        </span>
        On-device
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provenance stamp - the green-dot "Generated on-device by local Gemma" line
// (from EmployeeDetail), shown only when the local model actually answered. When
// Gemma is not running the answer stands on its own, with no disclaimer.
// ---------------------------------------------------------------------------
function ProvenanceStamp({ source }: { source: GemmaResult['source'] }) {
  if (source !== 'gemma') return null
  return (
    <p className="mt-2.5 flex items-center gap-1.5 font-mono text-xs text-subtle">
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ok" />
      Generated on-device by local Gemma
    </p>
  )
}

// ---------------------------------------------------------------------------
// One exchange: the question as a right-aligned "You" bubble, the answer as a
// left-aligned "OPSES" bubble carrying the model text and its provenance.
// ---------------------------------------------------------------------------
function TurnView({ turn }: { turn: Turn }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-line bg-surface-2 px-4 py-2.5">
          <span className="sr-only">You asked: </span>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">{turn.question}</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent"
        >
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line bg-ink px-4 py-3">
          <span className="sr-only">OPSES answered: </span>
          {turn.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
              Thinking on-device...
            </p>
          )}
          {turn.status === 'error' && (
            <p className="text-sm text-warn">
              The local model could not be reached. Make sure the Gemma server is running, then try
              again.
            </p>
          )}
          {turn.status === 'done' && turn.result && (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper">
                {turn.result.text}
              </p>
              <ProvenanceStamp source={turn.result.source} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suggested questions - clickable chips that submit a starter prompt. Shown
// prominently in the empty state and kept above the composer thereafter.
// ---------------------------------------------------------------------------
function SuggestedChips({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTED_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          disabled={disabled}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-paper disabled:pointer-events-none disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state - a friendly prompt before the first question is asked.
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-accent"
      >
        <Sparkles className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-lg text-paper">Ask your compliance copilot</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">
        Answers are generated on-device and grounded in your live findings, control posture, and
        usage. Pick a question below or type your own.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export default function Copilot() {
  const { org, findings } = useOpses()
  // Analytics is optional grounding context - pass it through when it is present.
  const { data: analytics } = useFetch(getAnalytics)
  const evals = useMemo(() => evaluateControls(findings), [findings])

  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  // Monotonic turn id - stable across renders without Math.random or Date.now.
  const nextId = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)

  const busy = turns.some((t) => t.status === 'loading')

  // Patch a single turn in place once its on-device call settles.
  const settle = (id: number, patch: Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const ask = (raw: string) => {
    const question = raw.trim()
    if (!question || busy) return
    const id = nextId.current++
    setTurns((prev) => [...prev, { id, question, result: null, status: 'loading' }])
    setInput('')
    askCompliance(question, org, findings, evals, analytics)
      .then((result) => settle(id, { result, status: 'done' }))
      .catch(() => settle(id, { status: 'error' }))
  }

  // Keep the newest exchange in view as the conversation grows.
  useEffect(() => {
    if (turns.length === 0) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Compliance copilot"
        subtitle="Ask anything about your AI-governance posture. Answered on-device, grounded in your real data."
      />

      <InHouseBanner />

      <Card className="flex flex-col overflow-hidden">
        {/* Conversation */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Copilot conversation"
          className="min-h-[20rem] space-y-5 p-4 sm:p-6"
        >
          {turns.length === 0 ? (
            <EmptyState />
          ) : (
            turns.map((turn) => <TurnView key={turn.id} turn={turn} />)
          )}
          <div ref={endRef} />
        </div>

        {/* Composer dock - suggested chips above, input + send below */}
        <div className="space-y-3 border-t border-line bg-surface-2/30 p-4 sm:p-5">
          <SuggestedChips onPick={ask} disabled={busy} />
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Sparkles
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent"
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a control, a finding, or your overall posture"
                aria-label="Ask the compliance copilot a question"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-paper placeholder:text-subtle focus-visible:border-accent"
              />
            </div>
            <Button type="submit" aria-label="Ask" disabled={busy || input.trim() === ''}>
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Ask</span>
            </Button>
          </form>
          <p className="font-mono text-xs text-subtle">
            OPSES answers from your live findings, controls, and usage. Nothing leaves the building.
          </p>
        </div>
      </Card>
    </div>
  )
}
