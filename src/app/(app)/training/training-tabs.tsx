'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function TrainingTabs({ canSeeMatrix }: { canSeeMatrix: boolean }) {
  const pathname = usePathname()
  const t = useTranslations('training.tabs')

  const tabs = [
    { href: '/training', key: 'tests', visible: true },
    { href: '/training/matrix', key: 'matrix', visible: canSeeMatrix },
    { href: '/training/my', key: 'my', visible: true },
  ].filter((tab) => tab.visible)

  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/12 text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(tab.key)}
          </Link>
        )
      })}
    </div>
  )
}
