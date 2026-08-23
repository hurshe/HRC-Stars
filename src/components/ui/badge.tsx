import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: '',
        success: '',
        warning: '',
        danger: '',
        info: '',
        gold: '',
      },
      variant: {
        solid: '',
        soft: '',
        outline: 'border bg-transparent',
      },
      size: {
        sm: 'px-2 py-0.5',
        md: 'px-2.5 py-1',
      },
    },
    compoundVariants: [
      { variant: 'solid', tone: 'neutral', class: 'bg-muted text-foreground' },
      { variant: 'solid', tone: 'success', class: 'bg-success text-success-foreground' },
      { variant: 'solid', tone: 'warning', class: 'bg-warning text-warning-foreground' },
      { variant: 'solid', tone: 'danger', class: 'bg-danger text-danger-foreground' },
      { variant: 'solid', tone: 'info', class: 'bg-info text-info-foreground' },
      { variant: 'solid', tone: 'gold', class: 'bg-gold text-gold-foreground' },

      { variant: 'soft', tone: 'neutral', class: 'bg-muted text-muted-foreground' },
      { variant: 'soft', tone: 'success', class: 'bg-success/15 text-success' },
      { variant: 'soft', tone: 'warning', class: 'bg-warning/15 text-warning' },
      { variant: 'soft', tone: 'danger', class: 'bg-danger/15 text-danger' },
      { variant: 'soft', tone: 'info', class: 'bg-info/15 text-info' },
      { variant: 'soft', tone: 'gold', class: 'bg-gold/15 text-gold' },

      { variant: 'outline', tone: 'neutral', class: 'border-border-strong text-muted-foreground' },
      { variant: 'outline', tone: 'success', class: 'border-success text-success' },
      { variant: 'outline', tone: 'warning', class: 'border-warning text-warning' },
      { variant: 'outline', tone: 'danger', class: 'border-danger text-danger' },
      { variant: 'outline', tone: 'info', class: 'border-info text-info' },
      { variant: 'outline', tone: 'gold', class: 'border-gold text-gold' },
    ],
    defaultVariants: { tone: 'neutral', variant: 'soft', size: 'sm' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>

export function Badge({
  className,
  tone,
  variant,
  size,
  children,
}: VariantProps<typeof badge> & { className?: string; children: ReactNode }) {
  return <span className={cn(badge({ tone, variant, size }), className)}>{children}</span>
}

/// Цвет по результату теста считается от настраиваемых порогов, а не задаётся
/// в коде: пороги меняются менеджером в интерфейсе, и бейдж обязан следовать
/// за ними, иначе цвет и вердикт разойдутся.
export function toneForScore(
  percent: number,
  bands: { danger: number; warning: number },
): BadgeTone {
  if (percent < bands.danger) return 'danger'
  if (percent < bands.warning) return 'warning'
  return 'success'
}

/// Доменные статусы. Список расширяется по мере появления модулей;
/// неизвестный статус получает нейтральный цвет, а не падает.
const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  PASSED: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',

  INVITED: 'info',
  IN_PROGRESS: 'info',
  PENDING: 'warning',
  EXPIRING_SOON: 'warning',
  ON_LEAVE: 'warning',

  FAILED: 'danger',
  EXPIRED: 'danger',
  OVERDUE: 'danger',
  SUSPENDED: 'danger',

  ARCHIVED: 'neutral',
  DRAFT: 'neutral',
  NOT_STARTED: 'neutral',
}

export function toneForStatus(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral'
}
