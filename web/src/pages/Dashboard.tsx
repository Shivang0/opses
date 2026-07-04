import { org } from '../data/sample'

// Placeholder — the build+QA workflow will develop this into the full CISO console
// (sidebar nav, KPI row, activity/cost charts, findings table, per-dev drill-down,
//  compliance view, slide-over detail) in the Stripe-clean tone.
export default function Dashboard() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">CISO Console</h1>
        <p className="mt-2 text-muted">Placeholder dashboard. The workflow builds this out.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Active developers', org.activeDevs],
            ['Open findings', org.openFindings],
            ['Compliance score', `${org.complianceScore}/100`],
            ['Cost MTD', `$${org.costMTD.toFixed(0)}`],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-[var(--radius)] border bg-surface p-4">
              <div className="text-sm text-muted">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
