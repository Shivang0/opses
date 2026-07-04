import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Element/tag to render (default 'section'). */
  as?: React.ElementType
  /** Classes for the inner max-width container. */
  containerClassName?: string
  /** Wrap children in the centered max-width container (default true). */
  container?: boolean
}

/**
 * Section — landing-page band. Full-bleed padding for vertical rhythm with a
 * centered max-width container inside. Set container={false} for hero rows that
 * need a custom inner layout.
 */
export function Section({
  as: Tag = 'section',
  className,
  containerClassName,
  container = true,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag className={cn('w-full px-6 py-20 sm:py-24 lg:py-28', className)} {...props}>
      {container ? (
        <div className={cn('mx-auto w-full max-w-6xl', containerClassName)}>{children}</div>
      ) : (
        children
      )}
    </Tag>
  )
}

/** Eyebrow — small mono/uppercase kicker above a section heading. */
export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary',
        className,
      )}
      {...props}
    />
  )
}
