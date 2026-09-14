import { cn } from '@/lib/utils'

/// Полоса прогресса программы. Завершённая программа — золотая: золото
/// в дизайн-системе закреплено за наградами и признанием
export function ProgressBar({
  percent,
  completed,
  label,
}: {
  percent: number
  completed?: boolean
  label: string
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn('h-full rounded-full transition-[width]', completed ? 'bg-gold' : 'bg-primary')}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
