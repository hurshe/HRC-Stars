'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { inviteMethods } from '@/lib/employee-schema'
import { createEmployeeAction, type CreateEmployeeState } from '../actions'

const initialState: CreateEmployeeState = {}

const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED'] as const
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'STUDENT', 'SEASONAL'] as const

type Option = { id: string; nameEn: string; namePl: string }

export function EmployeeForm({
  roles,
  positions,
  locale,
}: {
  roles: Option[]
  positions: (Option & { departmentEn: string; departmentPl: string })[]
  locale: string
}) {
  const t = useTranslations('employees.new')
  const tEmployees = useTranslations('employees')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('employees.errors')
  const tValidation = useTranslations('validation')
  const tCreated = useTranslations('employees.created')
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState)

  const label = (option: { nameEn: string; namePl: string }) =>
    locale === 'pl' ? option.namePl : option.nameEn

  const validationText = (code: string) =>
    tValidation.has(code) ? tValidation(code, { min: 10, length: 6 }) : code

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? validationText(state.fieldErrors[name]) : undefined

  // Учётка создана — показываем результат вместо формы: менеджеру нужно
  // либо скопировать ссылку, либо продиктовать код, и форма здесь только мешает
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

  return (
    <form action={formAction} className="space-y-5">
      {/* Форма не должна молча ничего не делать: если валидация не прошла,
          но ошибка не привязана к видимому полю, показываем её здесь */}
      {(state.error || state.fieldErrors) && (
        <FormError>{state.error ? tErrors(state.error) : tErrors('formInvalid')}</FormError>
      )}

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('sectionBasics')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} htmlFor="firstName" required error={fieldError('firstName')}>
            <Input id="firstName" name="firstName" required autoFocus />
          </Field>
          <Field label={t('lastName')} htmlFor="lastName" required error={fieldError('lastName')}>
            <Input id="lastName" name="lastName" required />
          </Field>
          <Field label={t('email')} htmlFor="email" required error={fieldError('email')}>
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field
            label={t('employeeNumber')}
            htmlFor="employeeNumber"
            hint={t('employeeNumberHint')}
            error={fieldError('employeeNumber')}
          >
            <Input id="employeeNumber" name="employeeNumber" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('sectionWork')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('role')} htmlFor="roleId" required error={fieldError('roleId')}>
            <Select id="roleId" name="roleId" required defaultValue="">
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
            <Input id="hiredAt" name="hiredAt" type="date" />
          </Field>

          <Field label={t('locale')} htmlFor="locale">
            <Select id="locale" name="locale" defaultValue="pl">
              <option value="pl">Polski</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <Field label={t('inviteMethod')} htmlFor="inviteMethod">
            <Select id="inviteMethod" name="inviteMethod" defaultValue="EMAIL_LINK">
              {inviteMethods.map((method) => (
                <option key={method} value={method}>
                  {t(`invite.${method}`)}
                </option>
              ))}
            </Select>
          </Field>
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

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{t('sectionPersonal')}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('personalNote')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} htmlFor="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" />
          </Field>
          <Field label={t('dateOfBirth')} htmlFor="dateOfBirth">
            <Input id="dateOfBirth" name="dateOfBirth" type="date" />
          </Field>
          <Field label={t('gender')} htmlFor="gender">
            <Select id="gender" name="gender" defaultValue="">
              <option value="">{t('notSelected')}</option>
              {GENDERS.map((value) => (
                <option key={value} value={value}>
                  {tEmployees(`gender.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('employmentType')} htmlFor="employmentType">
            <Select id="employmentType" name="employmentType" defaultValue="">
              <option value="">{t('notSelected')}</option>
              {EMPLOYMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {tEmployees(`employmentType.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('personalId')} htmlFor="personalId">
            <Input id="personalId" name="personalId" />
          </Field>
          <Field label={t('address')} htmlFor="address">
            <Input id="address" name="address" />
          </Field>
          <Field label={t('emergencyContactName')} htmlFor="emergencyContactName">
            <Input id="emergencyContactName" name="emergencyContactName" />
          </Field>
          <Field label={t('emergencyContactPhone')} htmlFor="emergencyContactPhone">
            <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" />
          </Field>
        </div>

        <Field label={t('notes')} htmlFor="notes">
          <Textarea id="notes" name="notes" />
        </Field>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {pending ? t('submitting') : t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/employees">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
