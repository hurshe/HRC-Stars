/// Ярлык сотрудника рядом с именем: SERVER · BARTENDER · TRAINER.
/// Признак тренера идёт последним и выделяется — это не должность,
/// а дополнительная роль поверх неё.
export function PositionBadges({
  positions,
  isTrainer,
  locale,
}: {
  positions: { code: string; nameEn: string; namePl: string }[]
  isTrainer: boolean
  locale: string
}) {
  if (positions.length === 0 && !isTrainer) return null

  return (
    <div className="flex flex-wrap justify-end gap-x-1.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
      {positions.map((position, index) => (
        <span key={position.code}>
          {locale === 'pl' ? position.namePl : position.nameEn}
          {index < positions.length - 1 && <span className="ml-1.5">·</span>}
        </span>
      ))}
      {isTrainer && (
        <>
          {positions.length > 0 && <span>·</span>}
          <span className="text-warning">TRAINER</span>
        </>
      )}
    </div>
  )
}
