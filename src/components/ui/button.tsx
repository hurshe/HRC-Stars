import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-medium',
    'transition-colors whitespace-nowrap',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-surface-elevated',
        outline: 'border border-border-strong text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        danger: 'bg-danger text-danger-foreground hover:opacity-90',
      },
      size: {
        // 44px — минимальный комфортный тач-таргет на телефоне и планшете
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        sm: 'h-9 px-3 text-sm',
        icon: 'size-11',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    /// Отрисовать как дочерний элемент — например, ссылку с видом кнопки
    asChild?: boolean
    /// Показать индикатор и заблокировать кнопку на время отправки
    loading?: boolean
  }

export function Button({
  className,
  variant,
  size,
  block,
  asChild,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button'

  return (
    <Component
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled || loading}
      // Скринридер должен узнать о загрузке, а не только увидеть крутилку
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Component>
  )
}
