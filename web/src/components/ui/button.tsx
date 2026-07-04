import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Button — restrained, enterprise-clean. One confident primary, a bordered
 * secondary/outline, and a quiet ghost. Every variant shares a visible
 * focus-visible ring for keyboard users.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)]',
    'font-medium transition-colors select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg shadow-sm hover:bg-primary/90 active:bg-primary/95',
        secondary: 'border border-border bg-surface text-ink shadow-sm hover:bg-canvas active:bg-canvas',
        outline: 'border border-border bg-surface text-ink shadow-sm hover:bg-canvas active:bg-canvas',
        ghost: 'text-ink-soft hover:bg-primary-soft hover:text-primary',
      },
      size: {
        sm: 'h-8 px-3 text-sm [&_svg]:size-4',
        md: 'h-10 px-4 text-sm [&_svg]:size-[18px]',
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
