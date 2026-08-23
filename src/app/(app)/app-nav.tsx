'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type NavItem = {
  key: string
  href: string
  /// Модуль появится на следующих этапах — пункт виден, но не кликается
  planned?: boolean
}

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label={t('ariaLabel')}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        if (item.planned) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              // В подпись входит и название модуля: иначе скринридер прочитает
              // только «Wkrótce», и станет непонятно, о каком разделе речь
              title={`${t(item.key)} — ${t('comingSoon')}`}
              className="shrink-0 cursor-default rounded-(--radius-control) px-3 py-2 text-sm text-muted-foreground/50"
            >
              {t(item.key)}
            </span>
          )
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}
