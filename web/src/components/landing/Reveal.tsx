import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Start already-shown when there's no observer or the user opted out of motion. */
function initialShown() {
  if (typeof window === 'undefined') return true
  if (!('IntersectionObserver' in window)) return true
  return prefersReducedMotion()
}

/**
 * useReveal — attach `ref` to any element and toggle the `.opses-reveal` /
 * `.is-in` classes off `shown`. Reveals once, then disconnects. Respects
 * prefers-reduced-motion (shows immediately, no transition).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState<boolean>(initialShown)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
    )
    io.observe(el)
    // Fail-safe: content must NEVER stay invisible. If the observer hasn't fired
    // shortly after mount (non-scrolling contexts, odd viewports, screenshots,
    // crawlers), reveal anyway.
    const fallback = window.setTimeout(() => {
      setShown(true)
      io.disconnect()
    }, 900)
    return () => {
      io.disconnect()
      window.clearTimeout(fallback)
    }
  }, [shown])

  return { ref, shown }
}

/** Live prefers-reduced-motion flag (updates if the user changes the setting). */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type RevealProps = HTMLAttributes<HTMLDivElement> & {
  /** Stagger delay in ms (adds transition-delay). */
  delay?: number
}

/** Reveal — a div that fades + rises into view once on scroll. */
export function Reveal({ className, delay, style, children, ...rest }: RevealProps) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={cn('opses-reveal', shown && 'is-in', className)}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
      {...rest}
    >
      {children}
    </div>
  )
}
