import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#compliance', label: 'Compliance' },
]

/** SiteFooter — minimal, mono. Hairline top border, wordmark, links, copyright. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="size-2.5 rotate-45 bg-accent" />
            <span className="font-mono text-sm font-medium tracking-[0.28em] text-paper">OPSES</span>
          </div>
          <p className="mt-3 font-mono text-xs tracking-[0.08em] text-subtle">
            Nothing leaves the building.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-subtle"
        >
          {FOOTER_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="opses-underline transition-colors hover:text-paper">
              {l.label}
            </a>
          ))}
          <Link to="/dashboard" className="opses-underline transition-colors hover:text-paper">
            Console
          </Link>
        </nav>

        <p className="font-mono text-xs tracking-[0.08em] text-subtle">© 2026 OPSES</p>
      </div>
    </footer>
  )
}
