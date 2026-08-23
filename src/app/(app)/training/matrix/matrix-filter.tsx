'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/field'

export function MatrixFilter({
  positions,
  locale,
}: {
  positions: { id: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const t = useTranslations('training.matrix')

  return (
    <Select
      defaultValue={params.get('positionId') ?? ''}
      aria-label={t('allPositions')}
      className="sm:w-64"
      disabled={pending}
      onChange={(event) => {
        const next = new URLSearchParams(params)
        if (event.target.value) next.set('positionId', event.target.value)
        else next.delete('positionId')
        startTransition(() => router.replace(`${pathname}?${next}`))
      }}
    >
      <option value="">{t('allPositions')}</option>
      {positions.map((position) => (
        <option key={position.id} value={position.id}>
          {locale === 'pl' ? position.namePl : position.nameEn}
        </option>
      ))}
    </Select>
  )
}
