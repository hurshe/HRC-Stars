'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { locales } from '@/i18n/config'
import { setLocale } from '@/server/actions/locale'
import { cn } from '@/lib/utils'

export function LocaleSwitcher({ className }: { className?: string }) {
  const current = useLocale()
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()

  return (
    <div
      className={cn('inline-flex rounded-(--radius-control) border border-border p-0.5', className)}
      role="group"
      aria-label={t('language')}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          aria-current={locale === current}
          onClick={() => startTransition(() => setLocale(locale))}
          className={cn(
            'rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-xs font-medium transition-colors',
            locale === current ? 'bg-accent text-accent-text' : 'text-text-muted hover:text-text',
            pending && 'opacity-60',
          )}
        >
          {t(`locale.${locale}`)}
        </button>
      ))}
    </div>
  )
}
