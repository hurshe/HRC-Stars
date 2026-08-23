import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Lock, Pencil } from 'lucide-react'
import { getPermissions, outranks, requirePermission } from '@/server/auth/session'
import { getEmployee, readPersonalData } from '@/server/services/employees'
import { Badge, toneForStatus } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InviteActions, TrainerToggle } from './employee-actions'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

export default async function EmployeeProfilePage({ params }: PageProps<'/employees/[id]'>) {
  const actor = await requirePermission('employee.view')
  const { id } = await params

  const employee = await getEmployee(actor, id)
  if (!employee) notFound()

  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('employees')

  // Персональные данные читаются отдельно: сам факт просмотра пишется
  // в аудит, поэтому вызов делается только когда данные действительно нужны
  const canSeePersonal = permissions.has('personal_data.view')
  const personal = canSeePersonal ? await readPersonalData(actor, employee.id) : null

  const pendingInvite = employee.invitations[0]
  const localized = (item: { nameEn: string; namePl: string }) =>
    locale === 'pl' ? item.namePl : item.nameEn

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('profile.backToList')}
        </Link>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{employee.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {employee.positions.map((entry) => (
                <Badge key={entry.position.code} variant="outline">
                  {localized(entry.position)}
                </Badge>
              ))}
              {employee.isTrainer && (
                <Badge tone="gold" variant="soft">
                  TRAINER
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge tone={toneForStatus(employee.status)} size="md">
              {t(`status.${employee.status}`)}
            </Badge>
            {/* Кнопку показываем только если редактирование реально доступно:
                права есть и человек ниже по иерархии */}
            {permissions.has('employee.edit') && outranks(actor, employee.role.level) && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/employees/${employee.id}/edit`}>
                  <Pencil className="size-4" aria-hidden />
                  {t('profile.edit')}
                </Link>
              </Button>
            )}
            <TrainerToggle
              userId={employee.id}
              isTrainer={employee.isTrainer}
              canManage={permissions.has('employee.trainer.manage')}
            />
          </div>
        </div>

        <dl>
          <Row label={t('table.number')} value={employee.employeeNumber} />
          <Row label={t('profile.role')} value={localized(employee.role)} />
          <Row
            label={t('profile.hiredAt')}
            value={employee.hiredAt ? format.dateTime(employee.hiredAt, { dateStyle: 'long' }) : null}
          />
          <Row
            label={t('profile.lastLogin')}
            value={
              employee.lastLoginAt
                ? format.dateTime(employee.lastLoginAt, { dateStyle: 'medium', timeStyle: 'short' })
                : t('profile.never')
            }
          />
        </dl>
      </Card>

      {employee.status === 'INVITED' && (
        <Card className="space-y-3 p-5">
          <p className="text-sm text-foreground">
            {pendingInvite
              ? t('profile.pendingInvite', {
                  date: format.dateTime(pendingInvite.expiresAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })
              : t('created.noInvite')}
          </p>
          <InviteActions userId={employee.id} canInvite={permissions.has('employee.invite')} />
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="font-display text-lg font-bold text-foreground">
            {t('profile.personalData')}
          </h2>
        </div>

        {!canSeePersonal ? (
          <p className="text-sm text-muted-foreground">{t('profile.personalDataHidden')}</p>
        ) : !personal ? (
          <p className="text-sm text-muted-foreground">{t('profile.personalDataEmpty')}</p>
        ) : (
          <dl>
            <Row label={t('new.phone')} value={personal.phone} />
            <Row label={t('new.dateOfBirth')} value={personal.dateOfBirth} />
            <Row
              label={t('new.gender')}
              value={personal.gender ? t(`gender.${personal.gender}`) : null}
            />
            <Row
              label={t('new.employmentType')}
              value={
                personal.employmentType ? t(`employmentType.${personal.employmentType}`) : null
              }
            />
            <Row label={t('new.address')} value={personal.address} />
            <Row label={t('new.personalId')} value={personal.personalId} />
            <Row label={t('new.emergencyContactName')} value={personal.emergencyContactName} />
            <Row label={t('new.emergencyContactPhone')} value={personal.emergencyContactPhone} />
            <Row label={t('new.notes')} value={personal.notes} />
          </dl>
        )}
      </Card>
    </div>
  )
}
