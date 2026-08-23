'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input } from '@/components/ui/field'
import { PASSWORD_MIN_LENGTH, PIN_LENGTH } from '@/lib/validation'
import type { FormState } from '../actions'
import { changePassword } from './actions'

const initialState: FormState = {}

export function ChangePasswordForm() {
  const t = useTranslations('auth.changePassword')
  const tError = useTranslations('auth.errors')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(changePassword, initialState)

  const validationText = (code: string) =>
    tValidation(code, { min: PASSWORD_MIN_LENGTH, length: PIN_LENGTH })

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <FormError>{tError(state.error, state.errorParams ?? {})}</FormError>}

      <Field label={t('current')} htmlFor="currentPassword">
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </Field>

      <Field
        label={t('new')}
        htmlFor="password"
        error={state.fieldErrors?.password && validationText(state.fieldErrors.password)}
        hint={validationText('passwordTooShort')}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field
        label={t('confirm')}
        htmlFor="passwordConfirm"
        error={
          state.fieldErrors?.passwordConfirm && validationText(state.fieldErrors.passwordConfirm)
        }
      >
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" block size="lg" disabled={pending}>
        {t('submit')}
      </Button>
    </form>
  )
}
