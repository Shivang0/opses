import * as React from 'react'
import { cn } from '../../lib/utils'
import { Eyebrow } from './section'

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Main page heading (rendered as <h1>). */
  title: React.ReactNode
  /** Optional secondary line under the title. */
  subtitle?: React.ReactNode
  /** Optional small kicker above the title. */
  eyebrow?: React.ReactNode
  /** Optional right-aligned actions (buttons, filters, etc.). */
  actions?: React.ReactNode
}

/**
 * PageHeader - the title block at the top of a console page. Oversized Fraunces
 * title (via the h1 default face). Stacks on mobile, splits title/actions on
 * wider screens.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl text-paper sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
