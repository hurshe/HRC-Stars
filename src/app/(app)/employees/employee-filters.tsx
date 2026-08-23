'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input, Select } from '@/components/ui/field'

const STATUSES = ['INVITED', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'ARCHIVED'] as const

export function EmployeeFilters({
  positions,
  locale,
}: {
  positions: { id: string; code: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  // Фильтры живут в адресной строке, а не в состоянии компонента: так
  // отфильтрованный список можно переслать коллеге ссылкой, и кнопка «назад»
  // работает как ожидается
  function apply(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // Любая смена фильтра сбрасывает страницу: иначе можно остаться
    // на пятой странице результата, где всего одна
    next.delete('page')
    startTransition(() => router.replace(`${pathname}?${next}`))
  }

  const t = useTranslations('employees')

  return (
    <div className="flex flex-col gap-2 sm:flex-row" data-pending={pending || undefined}>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          defaultValue={params.get('search') ?? ''}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-9"
          onChange={(event) => apply('search', event.target.value)}
        />
      </div>

      <Select
        defaultValue={params.get('positionId') ?? ''}
        aria-label={t('allPositions')}
        className="sm:w-52"
        onChange={(event) => apply('positionId', event.target.value)}
      >
        <option value="">{t('allPositions')}</option>
        {positions.map((position) => (
          <option key={position.id} value={position.id}>
            {locale === 'pl' ? position.namePl : position.nameEn}
          </option>
        ))}
      </Select>

      <Select
        defaultValue={params.get('status') ?? ''}
        aria-label={t('allStatuses')}
        className="sm:w-44"
        onChange={(event) => apply('status', event.target.value)}
      >
        <option value="">{t('allStatuses')}</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`status.${status}`)}
          </option>
        ))}
      </Select>
    </div>
  )
}
