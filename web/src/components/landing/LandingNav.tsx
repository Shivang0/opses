import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { buttonVariants } from '../ui'
import { cn } from '../../lib/utils'

const LINKS = [
  { href: '#problem', label: 'Problem' },
  { href: '#pipeline', label: 'How it works' },
  { href: '#compliance', label: 'Compliance' },
]

/**
 * LandingNav - a floating rounded pill (potpie-style) centered over the emerald
 * hero. Logo left, anchor links center, lime console CTA right. The pill's fill
 * and shadow strengthen once the page is scrolled; links collapse into a
 * disclosure card on small screens.
 */
export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4">
      <div
        className={cn(
          'mx-auto mt-4 flex h-14 max-w-5xl items-center justify-between rounded-full border pl-5 pr-2 transition-all duration-300',
          scrolled || open
            ? 'border-line bg-surface/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md'
            : 'border-line/60 bg-surface/40 backdrop-blur-sm',
        )}
      >
        <a href="#top" className="flex items-center gap-2.5" aria-label="OPSES - home">
          <span className="size-2.5 rotate-45 bg-accent" aria-hidden="true" />
          <span className="font-mono text-sm font-semibold tracking-[0.28em] text-paper">OPSES</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="opses-underline text-sm text-muted transition-colors hover:text-paper"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className={cn(
              buttonVariants({ variant: 'primary', size: 'sm' }),
              'hidden rounded-full px-4 sm:inline-flex',
            )}
          >
            View console
          </Link>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-paper md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn('mx-auto mt-2 max-w-5xl md:hidden', open ? 'block' : 'hidden')}
      >
        <nav
          className="flex flex-col rounded-2xl border border-line bg-surface/90 px-4 py-2 backdrop-blur-md"
          aria-label="Mobile"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-line-soft py-3 text-muted transition-colors last:border-0 hover:text-paper"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'my-3 w-full rounded-full')}
          >
            View console
          </Link>
        </nav>
      </div>
    </header>
  )
}
