import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { getPermissions, requireUser } from '@/server/auth/session'
import type { PermissionCode } from '@/lib/permissions'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Logo } from '@/components/logo'
import { AppNav, type NavItem } from './app-nav'
import { SignOutButton } from './sign-out-button'
import { PositionBadges } from './position-badges'

/// Пункт меню показывается, только если у сотрудника есть соответствующее право.
/// Это удобство интерфейса, а не защита: доступ проверяется в сервисном слое.
const NAV: (NavItem & { permission?: PermissionCode })[] = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'employees', href: '/employees', permission: 'employee.view', planned: true },
  { key: 'documents', href: '/documents', permission: 'document.view', planned: true },
  { key: 'training', href: '/training', permission: 'test.view', planned: true },
  { key: 'checklists', href: '/checklists', permission: 'checklist.view', planned: true },
  { key: 'tasks', href: '/tasks', permission: 'task.view', planned: true },
  { key: 'wildcards', href: '/wildcards', planned: true },
  { key: 'reports', href: '/reports', permission: 'report.view', planned: true },
  { key: 'settings', href: '/settings', permission: 'settings.view', planned: true },
]

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  // Пароль, выданный при активации, нужно сменить до начала работы
  if (user.mustChangePassword) redirect('/change-password')

  const permissions = await getPermissions(user.id)
  const locale = await getLocale()
  const items = NAV.filter((item) => !item.permission || permissions.has(item.permission))

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo />

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-foreground">{user.fullName}</div>
              <PositionBadges
                positions={user.positions}
                isTrainer={user.isTrainer}
                locale={locale}
              />
            </div>
            <ThemeSwitcher />
            <LocaleSwitcher />
            <SignOutButton />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-2 pb-2">
          <AppNav items={items} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
