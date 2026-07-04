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
 * LandingNav — sticky slim top bar. Transparent over the hero; a hairline bottom
 * border + blurred ink backdrop fade in once the page is scrolled. Anchor links
 * collapse into a disclosure menu on small screens.
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
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        scrolled || open
          ? 'border-line bg-ink/80 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="OPSES — home">
          <span className="size-2.5 rotate-45 bg-accent" aria-hidden="true" />
          <span className="font-mono text-sm font-medium tracking-[0.28em] text-paper">OPSES</span>
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
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'hidden sm:inline-flex')}
          >
            View console
          </Link>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-paper md:hidden"
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
        className={cn('border-t border-line md:hidden', open ? 'block' : 'hidden')}
      >
        <nav className="mx-auto flex max-w-6xl flex-col px-6 py-3" aria-label="Mobile">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-line-soft py-3 text-muted transition-colors hover:text-paper"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-4 w-full')}
          >
            View console
          </Link>
        </nav>
      </div>
    </header>
  )
}
