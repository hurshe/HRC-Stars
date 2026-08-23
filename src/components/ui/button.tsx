import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover',
        outline: 'border border-border-strong text-text hover:bg-surface-muted',
        ghost: 'text-text-muted hover:bg-surface-muted hover:text-text',
        danger: 'bg-danger text-accent-text hover:opacity-90',
      },
      size: {
        // Высота 44px — минимальный комфортный тач-таргет на телефоне и планшете
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        sm: 'h-9 px-3 text-sm',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, block }), className)} {...props} />
}
