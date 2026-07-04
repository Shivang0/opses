import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Button - cinematic-editorial. One confident amber primary, a hairline
 * secondary/outline, and a quiet ghost. Focus is handled by the global
 * :focus-visible accent outline (see index.css); motion is gated by
 * prefers-reduced-motion globally.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)]',
    'font-medium transition select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110 active:brightness-95',
        secondary:
          'border border-line bg-transparent text-paper hover:bg-surface-2 active:bg-surface-2',
        outline:
          'border border-line bg-transparent text-paper hover:bg-surface-2 active:bg-surface-2',
        ghost: 'text-muted hover:bg-surface-2 hover:text-paper',
      },
      size: {
        sm: 'h-8 px-3 text-sm [&_svg]:size-4',
        md: 'h-10 px-4 text-sm [&_svg]:size-[18px]',
        lg: 'h-12 px-6 text-[0.95rem] [&_svg]:size-[18px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
