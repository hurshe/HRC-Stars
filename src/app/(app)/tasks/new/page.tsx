import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/server/auth/session'
import { NewTaskForm } from './new-task-form'

export default async function NewTaskPage() {
  const actor = await requirePermission('task.create')
  const locale = await getLocale()
  const t = await getTranslations('tasks')

  // Показываем только тех, кому этот человек вправе поставить задачу:
  // список, где половина вариантов вызывает отказ, — плохой список
  const [users, roles, positions] = await Promise.all([
    db.user.findMany({
      where: {
        locationId: actor.locationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ON_LEAVE', 'INVITED'] },
        role: { level: { lt: actor.role.level } },
      },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.role.findMany({
      where: { level: { lt: actor.role.level } },
      orderBy: { level: 'desc' },
      select: { id: true, code: true },
    }),
    db.position.findMany({
      where: { isActive: true },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, nameEn: true, namePl: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('title')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('new.title')}</h1>
      </div>

      <NewTaskForm users={users} roles={roles} positions={positions} locale={locale} />
    </div>
  )
}
