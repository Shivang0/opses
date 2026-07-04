import { Link } from 'react-router-dom'

// Placeholder — the build+QA workflow will develop this into the full landing page
// (hero, problem, how-it-works, privacy, compliance, CTA) in the enterprise-clean tone.
export default function Landing() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-5xl px-6 py-28">
        <p className="font-mono text-sm font-medium tracking-wide text-primary">OPSES</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-ink">
          Governance for agentic AI — without the data ever leaving the building.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Placeholder landing. The workflow builds this out from the design brief.
        </p>
        <Link
          to="/dashboard"
          className="mt-8 inline-flex rounded-[var(--radius)] bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg"
        >
          View the CISO console
        </Link>
      </div>
    </main>
  )
}
