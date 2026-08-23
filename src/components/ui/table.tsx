import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/// Таблица всегда живёт внутри собственного горизонтального скролла:
/// на телефоне колонок больше, чем помещается, и страница целиком
/// ездить вбок не должна
export function TableWrapper({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-(--radius-panel) border border-border bg-card',
        className,
      )}
      {...props}
    />
  )
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-[40rem] border-collapse text-sm', className)} {...props} />
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-border', className)} {...props} />
}

export function TBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TR({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('transition-colors hover:bg-muted/50', className)} {...props} />
}

export function TH({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle text-foreground', className)} {...props} />
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && <div className="mb-2 text-muted-foreground">{icon}</div>}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
