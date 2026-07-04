import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Sidebar shell — a complementary vertical rail on surface. Compose a brand
 * mark, a <nav> of SidebarItems, and an optional footer inside it.
 */
export const Sidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        'flex h-full w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3',
        className,
      )}
      {...props}
    />
  ),
)
Sidebar.displayName = 'Sidebar'

export interface SidebarItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof NavLink>, 'className' | 'children'> {
  /** Leading icon (e.g. a lucide icon). Decorative — hidden from AT. */
  icon?: React.ReactNode
  /** Visible link label. */
  label: React.ReactNode
  /** Extra classes merged onto the link. */
  className?: string
}

/**
 * SidebarItem — a NavLink row. Active state is driven by the router; when
 * active it also gets aria-current="page" for assistive tech automatically.
 */
export const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  ({ icon, label, className, ...props }, ref) => (
    <NavLink
      ref={ref}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-canvas hover:text-ink',
          className,
        )
      }
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="shrink-0 [&_svg]:size-[18px]">
          {icon}
        </span>
      )}
      <span className="truncate">{label}</span>
    </NavLink>
  ),
)
SidebarItem.displayName = 'SidebarItem'
