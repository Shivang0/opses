// Data controls (Settings) - the admin surface for the in-house policy: how long
// captured telemetry is retained, and which classes of sensitive data the
// endpoint agent masks before anything leaves the machine. Reads GET /api/policy,
// writes PUT /api/policy. A real, persisted governance policy - retention plus the
// on-device masking rules applied at the endpoint.
import { useEffect, useState } from 'react'
import { AlertCircle, Check, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
} from '../ui'
import { useFetch } from '../../lib/useFetch'
import { getPolicy, savePolicy, type ApiPolicy } from '../../lib/api'
import { cn } from '../../lib/utils'

const RETENTIONS = [30, 60, 90, 180, 365]

const MASK_RULES: { key: keyof ApiPolicy['masking']; label: string; hint: string }[] = [
  { key: 'secrets', label: 'Secrets & credentials', hint: 'Passwords, private keys, connection strings' },
  { key: 'apiKeys', label: 'API keys & tokens', hint: 'Provider keys, bearer tokens, JWTs' },
  { key: 'pii', label: 'Personal data (PII)', hint: 'Names, addresses, national IDs, card numbers' },
  { key: 'emails', label: 'Email addresses', hint: 'Redact addresses found in prompts' },
]

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
        on ? 'border-accent/50 bg-accent/30' : 'border-line bg-surface-2',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-paper shadow transition-transform',
          on ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

export default function Settings() {
  const { status, data } = useFetch(getPolicy)
  const [policy, setPolicy] = useState<ApiPolicy | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setPolicy(data)
  }, [data])

  async function commit(patch: Partial<ApiPolicy>) {
    if (!policy) return
    const next = { ...policy, ...patch, masking: { ...policy.masking, ...(patch.masking || {}) } }
    setPolicy(next) // optimistic
    try {
      await savePolicy(patch)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
    } catch {
      /* leave optimistic value; a refresh will reconcile */
    }
  }

  const header = (
    <PageHeader
      eyebrow="Console"
      title="Data controls"
      subtitle="Retention and on-device masking policy for every seat OPSES watches."
      actions={
        saved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok">
            <Check className="size-3.5" aria-hidden="true" />
            Saved
          </span>
        ) : undefined
      }
    />
  )

  if ((status === 'loading' && !policy) || !policy) {
    return (
      <div className="space-y-8">
        {header}
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface p-6 text-sm text-muted">
          {status === 'loading' ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading policy...
            </>
          ) : (
            <>
              <AlertCircle className="size-5 shrink-0 text-warn" aria-hidden="true" />
              Policy is unavailable right now. The in-house server could not be reached.
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {header}

      {/* Retention */}
      <Card>
        <CardHeader>
          <CardTitle>Retention window</CardTitle>
          <CardDescription>How long captured session telemetry is kept before it is purged from the in-house store.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {RETENTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => commit({ retentionDays: d })}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  policy.retentionDays === d
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-paper',
                )}
              >
                {d} days
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Masking rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="size-4 text-accent" aria-hidden="true" />
            Masking rules
          </CardTitle>
          <CardDescription>
            Applied on the developer&apos;s machine, before any prompt is captured or transported. Nothing masked here ever leaves the building.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-line">
          {MASK_RULES.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-paper">{r.label}</p>
                <p className="text-xs text-muted">{r.hint}</p>
              </div>
              <Toggle
                on={policy.masking[r.key]}
                label={r.label}
                onChange={(v) => commit({ masking: { ...policy.masking, [r.key]: v } })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <p>
          Masking runs at the endpoint agent, so redacted content never reaches OPSES or any cloud model. Changes apply to the next
          captured session on every seat.
        </p>
      </div>
    </div>
  )
}
