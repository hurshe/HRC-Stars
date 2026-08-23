import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/server/auth/session'
import { EmployeeForm } from './employee-form'

export default async function NewEmployeePage() {
  const actor = await requirePermission('employee.create')
  const locale = await getLocale()
  const t = await getTranslations('employees.new')
  const tList = await getTranslations('employees')

  const [roles, positions] = await Promise.all([
    // Роли выше или равные своей выдать нельзя — их незачем и показывать
    db.role.findMany({
      where: { level: { lt: actor.role.level } },
      orderBy: { level: 'desc' },
      select: { id: true, nameEn: true, namePl: true },
    }),
    db.position.findMany({
      where: {
        isActive: true,
        // Kitchen Manager заводит людей только в свой департамент
        ...(actor.departmentScopeId ? { departmentId: actor.departmentScopeId } : {}),
      },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true,
        nameEn: true,
        namePl: true,
        department: { select: { nameEn: true, namePl: true } },
      },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tList('profile.backToList')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <EmployeeForm
        roles={roles}
        positions={positions.map((position) => ({
          id: position.id,
          nameEn: position.nameEn,
          namePl: position.namePl,
          departmentEn: position.department.nameEn,
          departmentPl: position.department.namePl,
        }))}
        locale={locale}
      />
    </div>
  )
}
