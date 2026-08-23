import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListTodo,
  Ticket,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getManagerSummary, getPersonalSummary } from '@/server/services/dashboard'
import { Card, StatCard } from '@/components/ui/card'

export default async function DashboardPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const t = await getTranslations('dashboard')
  const tNav = await getTranslations('nav')

  const [personal, manager] = await Promise.all([
    getPersonalSummary(user),
    getManagerSummary(user),
  ])

  // Плитки со ссылками: сводка бесполезна, если из неё нельзя сразу перейти
  // туда, где проблема решается
  const personalTiles = [
    {
      href: '/documents',
      label: tNav('documents'),
      value: personal.documentsToRead,
      icon: <FileText className="size-5" aria-hidden />,
    },
    {
      href: '/training/my',
      label: tNav('training'),
      value: personal.testsToTake,
      icon: <GraduationCap className="size-5" aria-hidden />,
    },
    {
      href: '/tasks',
      label: tNav('tasks'),
      value: personal.openTasks,
      icon: <ListTodo className="size-5" aria-hidden />,
    },
    {
      href: '/wildcards',
      label: tNav('wildcards'),
      value: personal.wildCards,
      icon: <Ticket className="size-5" aria-hidden />,
    },
  ]

  const managerTiles = manager
    ? [
        {
          href: '/employees',
          label: tNav('employees'),
          value: manager.staffCount,
          icon: <Users className="size-5" aria-hidden />,
        },
        {
          href: '/checklists',
          label: tNav('checklists'),
          value: manager.openChecklists,
          icon: <ClipboardCheck className="size-5" aria-hidden />,
        },
        {
          href: '/tasks?scope=all',
          label: t('overdueTasks'),
          value: manager.overdueTasks,
          icon: <TriangleAlert className="size-5" aria-hidden />,
        },
        {
          href: '/wildcards',
          label: t('pendingVouchers'),
          value: manager.pendingVouchers,
          icon: <Ticket className="size-5" aria-hidden />,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('welcome', { name: user.firstName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === 'pl' ? user.role.namePl : user.role.nameEn} · {user.locationName}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{t('yours')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {personalTiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className="group">
              <StatCard
                label={tile.label}
                value={tile.value}
                icon={tile.icon}
                className="h-full transition-colors group-hover:border-border-strong"
              />
            </Link>
          ))}
        </div>
      </section>

      {manager && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">{t('team')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {managerTiles.map((tile) => (
              <Link key={tile.label} href={tile.href} className="group">
                <StatCard
                  label={tile.label}
                  value={tile.value}
                  icon={tile.icon}
                  className="h-full transition-colors group-hover:border-border-strong"
                />
              </Link>
            ))}
          </div>

          {manager.expiringDocuments > 0 && (
            <Card className="flex items-center gap-3 border-warning/40 bg-warning/10 p-4">
              <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
              <p className="text-sm text-foreground">
                {t('expiringDocuments', { count: manager.expiringDocuments })}
              </p>
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
