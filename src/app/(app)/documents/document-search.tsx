'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input, Select } from '@/components/ui/field'

export function DocumentSearch({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const t = useTranslations('documents')

  // Как и в списке сотрудников, фильтры живут в адресной строке —
  // ссылку с отфильтрованным списком можно переслать
  function apply(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => router.replace(`${pathname}?${next}`))
  }

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

      {categories.length > 0 && (
        <Select
          defaultValue={params.get('categoryId') ?? ''}
          aria-label={t('allCategories')}
          className="sm:w-56"
          onChange={(event) => apply('categoryId', event.target.value)}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}
