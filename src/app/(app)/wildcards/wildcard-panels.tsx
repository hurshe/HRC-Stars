'use client'

import { useActionState, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import {
  allocateToManagerAction,
  decideVoucherAction,
  grantWildCardsAction,
  markVoucherUsedAction,
  requestVoucherAction,
  type WildCardFormState,
} from './actions'

const initialState: WildCardFormState = {}

export function GrantPanel({
  employees,
}: {
  employees: { id: string; firstName: string; lastName: string }[]
}) {
  const t = useTranslations('wildcards.grant')
  const tErrors = useTranslations('wildcards.errors')
  const [state, formAction, pending] = useActionState(grantWildCardsAction, initialState)

  return (
    <Card className="p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Field label={t('employee')} htmlFor="userId" required>
            <Select id="userId" name="userId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="w-28">
          <Field label={t('amount')} htmlFor="amount" required>
            <Input id="amount" name="amount" type="number" min={1} max={50} defaultValue={1} required />
          </Field>
        </div>

        <div className="min-w-52 flex-1">
          <Field label={t('reason')} htmlFor="reason" required hint={t('reasonHint')}>
            <Input id="reason" name="reason" required />
          </Field>
        </div>

        <Button type="submit" loading={pending}>
          {t('submit')}
        </Button>

        <details className="w-full">
          <summary className="cursor-pointer text-xs text-muted-foreground">{t('note')}</summary>
          <Textarea name="note" className="mt-2" />
        </details>

        {state.error && <FormError>{tErrors(state.error)}</FormError>}
      </form>
    </Card>
  )
}

/// Пополнение счёта менеджера. Карты здесь бессрочные — дата сгорания
/// появится только когда менеджер отдаст их сотруднику
export function AllocatePanel({
  managers,
}: {
  managers: { id: string; firstName: string; lastName: string; role: string; balance: number }[]
}) {
  const t = useTranslations('wildcards.stock')
  const tErrors = useTranslations('wildcards.errors')
  const [state, formAction, pending] = useActionState(allocateToManagerAction, initialState)

  return (
    <Card className="p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Field label={t('manager')} htmlFor="managerId" required>
            <Select id="managerId" name="managerId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.firstName} {manager.lastName} · {manager.role} ·{' '}
                  {t('allocated', { balance: manager.balance })}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="w-28">
          <Field label={t('amount')} htmlFor="allocate-amount" required>
            <Input
              id="allocate-amount"
              name="amount"
              type="number"
              min={1}
              max={500}
              defaultValue={10}
              required
            />
          </Field>
        </div>

        <div className="min-w-52 flex-1">
          <Field label={t('note')} htmlFor="allocate-note">
            <Input id="allocate-note" name="note" />
          </Field>
        </div>

        <Button type="submit" loading={pending}>
          {t('submit')}
        </Button>

        {state.error && <FormError>{tErrors(state.error)}</FormError>}
      </form>
    </Card>
  )
}

export function RequestButton({
  voucherTypeId,
  disabled,
}: {
  voucherTypeId: string
  disabled: boolean
}) {
  const t = useTranslations('wildcards')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        block
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await requestVoucherAction(voucherTypeId)
            setError(result.ok ? null : result.error)
          })
        }
      >
        {t('catalog.request')}
      </Button>
      {error && <p className="text-xs text-danger">{t(`errors.${error}`)}</p>}
    </div>
  )
}

export function RequestDecision({ requestId }: { requestId: string }) {
  const t = useTranslations('wildcards.requests')
  const tErrors = useTranslations('wildcards.errors')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function decide(approve: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await decideVoucherAction(requestId, approve)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => decide(true)}
        aria-label={t('approve')}
        title={t('approve')}
      >
        <Check className="size-4 text-success" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => decide(false)}
        aria-label={t('reject')}
        title={t('reject')}
      >
        <X className="size-4 text-danger" aria-hidden />
      </Button>
      {error && <span className="text-xs text-danger">{tErrors(error)}</span>}
    </div>
  )
}

export function MarkUsedButton({ requestId }: { requestId: string }) {
  const t = useTranslations('wildcards.requests')
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => markVoucherUsedAction(requestId).then(() => undefined))}
    >
      {t('markUsed')}
    </Button>
  )
}
