import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Badge — compact status pill on the dark theme. Severity variants use the
 * severity token at low-alpha tint + full-strength text and ring; neutral is a
 * quiet surface chip. Keys line up with the app's Severity union
 * ('high' | 'medium' | 'low') plus status tones, so you can drive it straight
 * from data: <Badge variant={finding.severity}>High</Badge>.
 *
 *   high   -> danger    medium -> warn     low -> neutral
 *   ok     -> ok        info   -> info     neutral (default) -> muted
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-2 text-muted ring-line',
        high: 'bg-danger/15 text-danger ring-danger/25',
        medium: 'bg-warn/15 text-warn ring-warn/25',
        low: 'bg-surface-2 text-muted ring-line',
        ok: 'bg-ok/15 text-ok ring-ok/25',
        info: 'bg-info/15 text-info ring-info/25',
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
