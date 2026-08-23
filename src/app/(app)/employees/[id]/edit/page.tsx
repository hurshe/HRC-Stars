import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { getPermissions, outranks, requirePermission } from '@/server/auth/session'
import { getEmployee, readPersonalData } from '@/server/services/employees'
import { EmployeeForm } from '../../employee-form'
import { updateEmployeeAction } from '../../actions'

export default async function EditEmployeePage({ params }: PageProps<'/employees/[id]/edit'>) {
  const actor = await requirePermission('employee.edit')
  const { id } = await params

  const employee = await getEmployee(actor, id)
  if (!employee) notFound()

  // Форму редактирования нельзя даже открыть на равном или старшем по уровню:
  // сервис всё равно откажет, а показывать заведомо нерабочую форму — обман
  if (!outranks(actor, employee.role.level)) redirect(`/employees/${id}`)

  const permissions = await getPermissions(actor.id)
  const canEditPersonal = permissions.has('personal_data.edit')
  const locale = await getLocale()
  const t = await getTranslations('employees.edit')
  const tList = await getTranslations('employees')

  // Персданные подгружаем только если их и правда можно редактировать —
  // иначе это лишняя запись в аудите о просмотре
  const personal = canEditPersonal ? await readPersonalData(actor, employee.id) : null

  const [roles, positions] = await Promise.all([
    db.role.findMany({
      where: { level: { lt: actor.role.level } },
      orderBy: { level: 'desc' },
      select: { id: true, nameEn: true, namePl: true },
    }),
    db.position.findMany({
      where: {
        isActive: true,
        ...(actor.departmentScopeId ? { departmentId: actor.departmentScopeId } : {}),
      },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, nameEn: true, namePl: true },
    }),
  ])

  const primary = employee.positions.find((entry) => entry.isPrimary) ?? employee.positions[0]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/employees/${employee.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {employee.firstName} {employee.lastName}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <EmployeeForm
        mode="edit"
        action={updateEmployeeAction}
        roles={roles}
        positions={positions}
        locale={locale}
        canEditPersonal={canEditPersonal}
        defaults={{
          userId: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          employeeNumber: employee.employeeNumber,
          roleId: employee.role.id,
          positionIds: employee.positions.map((entry) => entry.position.id),
          primaryPositionId: primary?.position.id,
          // <input type="date"> понимает только YYYY-MM-DD
          hiredAt: employee.hiredAt?.toISOString().slice(0, 10) ?? '',
          locale: employee.locale,
          status: employee.status,
          ...(personal ?? {}),
        }}
      />

      <p className="text-xs text-muted-foreground">{tList('new.personalNote')}</p>
    </div>
  )
}
