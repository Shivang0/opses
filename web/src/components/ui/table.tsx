import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Table primitives — transparent, dense, accessible <table> semantics with
 * hairline row borders and a mono-eyebrow header. The root wraps the table in a
 * horizontally scrollable region so wide tables never break the mobile layout.
 */
export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // `relative` makes this the containing block for any absolutely-positioned
    // descendants (e.g. sr-only cells), so they are clipped by overflow-x-auto
    // and never widen the document past the viewport on small screens.
    <div className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  ),
)
Table.displayName = 'Table'

export const THead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('border-b border-line', className)} {...props} />
))
THead.displayName = 'THead'

export const TBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('divide-y divide-line', className)} {...props} />
))
TBody.displayName = 'TBody'

export const TR = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors hover:bg-surface-2 data-[state=selected]:bg-accent/10',
        className,
      )}
      {...props}
    />
  ),
)
TR.displayName = 'TR'

export const TH = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, scope = 'col', ...props }, ref) => (
  <th
    ref={ref}
    scope={scope}
    className={cn(
      'h-10 px-3 text-left align-middle font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-subtle whitespace-nowrap',
      className,
    )}
    {...props}
  />
))
TH.displayName = 'TH'

export const TD = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2.5 align-middle text-muted', className)} {...props} />
))
TD.displayName = 'TD'
