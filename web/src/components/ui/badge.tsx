import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Badge — compact status pill. The variant keys line up with the app's
 * Severity union ('high' | 'medium' | 'low') plus status tones, so you can
 * drive it straight from data: <Badge variant={finding.severity}>High</Badge>.
 *
 *   high   -> danger    medium -> warn     low -> muted
 *   ok     -> ok        info   -> info      neutral (default) -> muted/border
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-canvas text-muted ring-border',
        high: 'bg-danger-soft text-danger ring-danger/20',
        medium: 'bg-warn-soft text-warn ring-warn/20',
        low: 'bg-canvas text-muted ring-border',
        ok: 'bg-ok-soft text-ok ring-ok/20',
        info: 'bg-primary-soft text-info ring-info/20',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
