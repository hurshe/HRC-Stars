import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-(--radius-panel) border border-border bg-card', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-start justify-between gap-3 p-4 pb-0', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-base font-semibold text-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />
}

/// Плитка с числом на дашборде: значение, подпись и опциональная динамика.
/// Отдельный компонент, а не разметка на каждой странице, — иначе плитки
/// на разных экранах разъедутся по отступам и размеру шрифта.
export function StatCard({
  label,
  value,
  icon,
  trend,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  /// Динамика к прошлому периоду. direction определяет цвет и стрелку
  trend?: { value: string; direction: 'up' | 'down' | 'flat' }
  className?: string
}) {
  const trendTone =
    trend?.direction === 'up'
      ? 'text-success'
      : trend?.direction === 'down'
        ? 'text-danger'
        : 'text-muted-foreground'

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs tracking-wide text-muted-foreground uppercase">
            {label}
          </div>
          <div className="mt-1 font-display text-3xl leading-none font-bold text-foreground">
            {value}
          </div>
          {trend && (
            <div className={cn('mt-1.5 text-xs font-medium', trendTone)}>
              {trend.direction === 'up' && '↑ '}
              {trend.direction === 'down' && '↓ '}
              {trend.value}
            </div>
          )}
        </div>
        {icon && (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-muted text-muted-foreground"
            aria-hidden
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
