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
    <nav className="flex gap-1 overflow-x-auto" aria-label="Główna nawigacja">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        if (item.planned) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              title="Wkrótce / Coming soon"
              className="shrink-0 cursor-default rounded-(--radius-control) px-3 py-2 text-sm text-text-muted/50"
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
              active ? 'bg-surface-muted text-text' : 'text-text-muted hover:bg-surface-muted hover:text-text',
            )}
          >
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )
}
