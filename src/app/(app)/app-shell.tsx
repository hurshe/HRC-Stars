'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Menu,
  Palette,
  Settings,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const ICONS = {
  dashboard: LayoutDashboard,
  employees: Users,
  documents: FileText,
  training: GraduationCap,
  checklists: ClipboardCheck,
  tasks: ListTodo,
  wildcards: Ticket,
  reports: BarChart3,
  settings: Settings,
  designSystem: Palette,
} as const

export type ShellNavItem = {
  key: keyof typeof ICONS
  href: string
  /// Модуль появится на следующих этапах: пункт виден, но не кликается
  planned?: boolean
}

function NavList({ items, onNavigate }: { items: ShellNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key]
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        if (item.planned) {
          return (
            <li key={item.key}>
              <span
                aria-disabled="true"
                // Название модуля должно быть в подписи: иначе скринридер
                // прочитает только «Скоро» и непонятно, о каком разделе речь
                title={`${t(item.key)} — ${t('comingSoon')}`}
                className="flex cursor-default items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-sm text-muted-foreground/45"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t(item.key)}</span>
              </span>
            </li>
          )
        }

        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/12 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', active && 'text-primary')}
                aria-hidden
              />
              <span className="truncate">{t(item.key)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function AppShell({
  items,
  logo,
  userCard,
  topbarActions,
  children,
}: {
  items: ShellNavItem[]
  logo: ReactNode
  userCard: ReactNode
  topbarActions: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  // Меню открыто только для того пути, на котором его открыли. Как только
  // путь меняется — любой навигацией, включая кнопку «назад», — оно само
  // считается закрытым. Это дешевле и надёжнее, чем закрывать его эффектом
  // на смену пути: лишнего рендера не возникает вовсе.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const mobileOpen = openedAt === pathname
  const setMobileOpen = (open: boolean) => setOpenedAt(open ? pathname : null)

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center px-5">{logo}</div>
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={t('ariaLabel')}>
        <NavList items={items} onNavigate={() => setMobileOpen(false)} />
      </nav>
      <div className="border-t border-border p-3">{userCard}</div>
    </>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Постоянный сайдбар на десктопе */}
      <aside className="hidden border-r border-border bg-card lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0">
        {sidebarContent}
      </aside>

      {/* Выдвижное меню на телефоне и планшете */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-card">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-(--radius-control) p-2 text-muted-foreground hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="lg:hidden">{logo}</div>

          <div className="ml-auto flex items-center gap-2">{topbarActions}</div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
