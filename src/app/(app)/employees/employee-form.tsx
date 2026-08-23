'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { employeeStatuses, inviteMethods } from '@/lib/employee-schema'
import type { EmployeeFormState } from './actions'

const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED'] as const
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'STUDENT', 'SEASONAL'] as const

type Option = { id: string; nameEn: string; namePl: string }

export type EmployeeDefaults = {
  userId?: string
  firstName?: string
  lastName?: string
  email?: string
  employeeNumber?: string | null
  roleId?: string
  positionIds?: string[]
  primaryPositionId?: string
  hiredAt?: string | null
  locale?: string
  status?: string
  phone?: string | null
  dateOfBirth?: string | null
  address?: string | null
  personalId?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  gender?: string | null
  employmentType?: string | null
  notes?: string | null
}

const initialState: EmployeeFormState = {}

/// Одна форма на создание и на редактирование: поля обязаны совпадать,
/// а два отдельных компонента разъезжаются уже на второй правке.
export function EmployeeForm({
  mode,
  action,
  roles,
  positions,
  locale,
  canEditPersonal,
  defaults = {},
}: {
  mode: 'create' | 'edit'
  action: (state: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>
  roles: Option[]
  positions: Option[]
  locale: string
  canEditPersonal: boolean
  defaults?: EmployeeDefaults
}) {
  const t = useTranslations('employees.new')
  const tEmployees = useTranslations('employees')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('employees.errors')
  const tValidation = useTranslations('validation')
  const tCreated = useTranslations('employees.created')
  const [state, formAction, pending] = useActionState(action, initialState)

  const label = (option: { nameEn: string; namePl: string }) =>
    locale === 'pl' ? option.namePl : option.nameEn

  // Незнакомый код ошибки не должен ронять страницу отсутствующим ключом
  const validationText = (code: string) =>
    tValidation.has(code) ? tValidation(code, { min: 10, length: 6 }) : code

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? validationText(state.fieldErrors[name]) : undefined

  const selectedPositions = new Set(defaults.positionIds ?? [])

  // Учётка создана — показываем результат вместо формы: менеджеру нужно
  // либо скопировать ссылку, либо продиктовать код, форма здесь только мешает
  if (state.created) {
    const { created } = state
    return (
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl font-bold text-foreground">{tCreated('title')}</h2>

        {created.activationCode ? (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{tCreated('codeLabel')}</div>
            <div className="rounded-(--radius-control) border border-border-strong bg-muted px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-foreground">
              {created.activationCode}
            </div>
          </div>
        ) : created.invitationUrl ? (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              {created.emailSent
                ? tCreated('emailSent', { email: created.email })
                : tCreated('emailFailed')}
            </p>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{tCreated('linkLabel')}</div>
              <div className="rounded-(--radius-control) border border-border bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
                {created.invitationUrl}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tCreated('noInvite')}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link href={`/employees/${created.userId}`}>{tCreated('toProfile')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/employees/new">{tCreated('addAnother')}</Link>
          </Button>
        </div>
      </Card>
    )
  }

  const backHref = mode === 'edit' && defaults.userId ? `/employees/${defaults.userId}` : '/employees'

  return (
    <form action={formAction} className="space-y-5">
      {defaults.userId && <input type="hidden" name="userId" value={defaults.userId} />}

      {/* Форма не должна молча ничего не делать: если валидация не прошла,
          но ошибка не привязана к видимому полю, показываем её здесь */}
      {(state.error || state.fieldErrors) && (
        <FormError>{state.error ? tErrors(state.error) : tErrors('formInvalid')}</FormError>
      )}

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('sectionBasics')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} htmlFor="firstName" required error={fieldError('firstName')}>
            <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required autoFocus />
          </Field>
          <Field label={t('lastName')} htmlFor="lastName" required error={fieldError('lastName')}>
            <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
          </Field>

          {mode === 'create' ? (
            <Field label={t('email')} htmlFor="email" required error={fieldError('email')}>
              <Input id="email" name="email" type="email" required />
            </Field>
          ) : (
            // Смена адреса — отдельная операция: на него завязан вход в систему
            <Field label={t('email')} htmlFor="email">
              <Input id="email" value={defaults.email ?? ''} disabled readOnly />
            </Field>
          )}

          <Field
            label={t('employeeNumber')}
            htmlFor="employeeNumber"
            hint={mode === 'create' ? t('employeeNumberHint') : undefined}
            error={fieldError('employeeNumber')}
          >
            <Input
              id="employeeNumber"
              name="employeeNumber"
              defaultValue={defaults.employeeNumber ?? ''}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('sectionWork')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('role')} htmlFor="roleId" required error={fieldError('roleId')}>
            <Select id="roleId" name="roleId" required defaultValue={defaults.roleId ?? ''}>
              <option value="" disabled>
                {t('notSelected')}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {label(role)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('hiredAt')} htmlFor="hiredAt" error={fieldError('hiredAt')}>
            <Input id="hiredAt" name="hiredAt" type="date" defaultValue={defaults.hiredAt ?? ''} />
          </Field>

          <Field label={t('locale')} htmlFor="locale">
            <Select id="locale" name="locale" defaultValue={defaults.locale ?? 'pl'}>
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </Select>
          </Field>

          {mode === 'create' ? (
            <Field label={t('inviteMethod')} htmlFor="inviteMethod">
              <Select id="inviteMethod" name="inviteMethod" defaultValue="EMAIL_LINK">
                {inviteMethods.map((method) => (
                  <option key={method} value={method}>
                    {t(`invite.${method}`)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={tEmployees('table.status')} htmlFor="status">
              <Select id="status" name="status" defaultValue={defaults.status ?? 'ACTIVE'}>
                {employeeStatuses.map((status) => (
                  <option key={status} value={status}>
                    {tEmployees(`status.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            {t('positions')}
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          </legend>
          <p className="text-xs text-muted-foreground">{t('positionsHint')}</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((position) => (
              <label
                key={position.id}
                className="flex items-center gap-2 rounded-(--radius-control) border border-border px-3 py-2 text-sm text-foreground has-checked:border-primary has-checked:bg-primary/10"
              >
                <input
                  type="checkbox"
                  name="positionIds"
                  value={position.id}
                  defaultChecked={selectedPositions.has(position.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="truncate">{label(position)}</span>
              </label>
            ))}
          </div>
          {state.fieldErrors?.positionIds && (
            <p role="alert" className="text-xs text-danger">
              {validationText(state.fieldErrors.positionIds)}
            </p>
          )}
        </fieldset>
      </Card>

      {canEditPersonal && (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {t('sectionPersonal')}
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('personalNote')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('phone')} htmlFor="phone">
              <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone ?? ''} />
            </Field>
            <Field label={t('dateOfBirth')} htmlFor="dateOfBirth">
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={defaults.dateOfBirth ?? ''} />
            </Field>
            <Field label={t('gender')} htmlFor="gender">
              <Select id="gender" name="gender" defaultValue={defaults.gender ?? ''}>
                <option value="">{t('notSelected')}</option>
                {GENDERS.map((value) => (
                  <option key={value} value={value}>
                    {tEmployees(`gender.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('employmentType')} htmlFor="employmentType">
              <Select
                id="employmentType"
                name="employmentType"
                defaultValue={defaults.employmentType ?? ''}
              >
                <option value="">{t('notSelected')}</option>
                {EMPLOYMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {tEmployees(`employmentType.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('personalId')} htmlFor="personalId">
              <Input id="personalId" name="personalId" defaultValue={defaults.personalId ?? ''} />
            </Field>
            <Field label={t('address')} htmlFor="address">
              <Input id="address" name="address" defaultValue={defaults.address ?? ''} />
            </Field>
            <Field label={t('emergencyContactName')} htmlFor="emergencyContactName">
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={defaults.emergencyContactName ?? ''}
              />
            </Field>
            <Field label={t('emergencyContactPhone')} htmlFor="emergencyContactPhone">
              <Input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                defaultValue={defaults.emergencyContactPhone ?? ''}
              />
            </Field>
          </div>

          <Field label={t('notes')} htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ''} />
          </Field>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {mode === 'create' ? t('submit') : tCommon('save')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={backHref}>{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
