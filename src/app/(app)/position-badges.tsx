import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'

/// Ярлык сотрудника рядом с именем: SERVER · BARTENDER · TRAINER.
/// Признак тренера идёт последним и выделяется — это не должность,
/// а дополнительная роль поверх неё.
export async function PositionBadges({
  positions,
  isTrainer,
  locale,
  align = 'end',
  className,
}: {
  positions: { code: string; nameEn: string; namePl: string }[]
  isTrainer: boolean
  locale: string
  align?: 'start' | 'end'
  className?: string
}) {
  if (positions.length === 0 && !isTrainer) return null

  const t = await getTranslations('trainer')

  return (
    <div
      className={cn(
        'flex flex-wrap gap-x-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase',
        align === 'end' ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {positions.map((position, index) => (
        <span key={position.code} className="truncate">
          {locale === 'pl' ? position.namePl : position.nameEn}
          {index < positions.length - 1 && <span className="ml-1.5">·</span>}
        </span>
      ))}
      {isTrainer && (
        <>
          {positions.length > 0 && <span>·</span>}
          <span className="text-gold">{t('badge')}</span>
        </>
      )}
    </div>
  )
}
