import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Sidebar shell - a complementary vertical rail on the near-black band, split
 * from content by a single hairline. Compose a brand mark, a <nav> of
 * SidebarItems, and an optional footer inside it.
 */
export const Sidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        'flex h-full w-60 shrink-0 flex-col gap-1 border-r border-line bg-ink-2 p-3',
        className,
      )}
      {...props}
    />
  ),
)
Sidebar.displayName = 'Sidebar'

export interface SidebarItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof NavLink>, 'className' | 'children'> {
  /** Leading icon (e.g. a lucide icon). Decorative - hidden from AT. */
  icon?: React.ReactNode
  /** Visible link label. */
  label: React.ReactNode
  /** Extra classes merged onto the link. */
  className?: string
}

/**
 * SidebarItem - a NavLink row. Active state is driven by the router: it shows a
 * left amber marker and brightens to paper text, and gets aria-current="page"
 * for assistive tech automatically. Focus uses the global accent outline.
 */
export const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  ({ icon, label, className, ...props }, ref) => (
    <NavLink
      ref={ref}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-surface-2 text-paper before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-accent'
            : 'text-muted hover:bg-surface-2 hover:text-paper',
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
