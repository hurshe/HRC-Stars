import { redirect } from 'next/navigation'
import { getPermissions, requireUser } from '@/server/auth/session'
import type { PermissionCode } from '@/lib/permissions'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Logo } from '@/components/logo'
import { AppShell, type ShellNavItem } from './app-shell'
import { UserCard } from './user-card'

/// Пункт меню показывается, только если у сотрудника есть соответствующее право.
/// Это удобство интерфейса, а не защита: доступ проверяется в сервисном слое.
const NAV: (ShellNavItem & { permission?: PermissionCode })[] = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'employees', href: '/employees', permission: 'employee.view' },
  { key: 'documents', href: '/documents' },
  { key: 'training', href: '/training', permission: 'test.view' },
  { key: 'checklists', href: '/checklists', permission: 'checklist.view' },
  { key: 'tasks', href: '/tasks', permission: 'task.view' },
  { key: 'wildcards', href: '/wildcards' },
  { key: 'reports', href: '/reports', permission: 'report.view', planned: true },
  { key: 'settings', href: '/settings', permission: 'settings.view' },
]

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()

  // Пароль, выданный при активации, нужно сменить до начала работы
  if (user.mustChangePassword) redirect('/change-password')

  const permissions = await getPermissions(user.id)
  const items = NAV.filter((item) => !item.permission || permissions.has(item.permission))

  return (
    <AppShell
      items={items}
      logo={<Logo />}
      userCard={<UserCard user={user} />}
      topbarActions={
        <>
          <ThemeSwitcher />
          <LocaleSwitcher />
        </>
      }
    >
      {children}
    </AppShell>
  )
}
