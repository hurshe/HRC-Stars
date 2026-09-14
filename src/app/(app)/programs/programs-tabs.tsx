'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function ProgramsTabs({
  canSeePrograms,
  canSeeCertificates,
}: {
  canSeePrograms: boolean
  canSeeCertificates: boolean
}) {
  const pathname = usePathname()
  const t = useTranslations('programs.tabs')

  const tabs = [
    { href: '/programs', key: 'my', visible: true },
    { href: '/programs/all', key: 'all', visible: canSeePrograms },
    { href: '/programs/certificates', key: 'certificates', visible: canSeeCertificates },
  ].filter((tab) => tab.visible)

  // Сотруднику без прав на управление полоса с единственной вкладкой не нужна
  if (tabs.length < 2) return null

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
