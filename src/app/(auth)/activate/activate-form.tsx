'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input } from '@/components/ui/field'
import { PASSWORD_MIN_LENGTH, PIN_LENGTH } from '@/lib/validation'
import { activateAccount, type FormState } from '../actions'

const initialState: FormState = {}

export function ActivateForm({
  token,
  knownEmail,
}: {
  token: string
  knownEmail: string | null
}) {
  const t = useTranslations('auth.activate')
  const tError = useTranslations('auth.errors')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(activateAccount, initialState)

  // Параметры передаём всегда: какое именно сообщение вернёт сервер, заранее неизвестно
  const validationText = (code: string) =>
    tValidation(code, { min: PASSWORD_MIN_LENGTH, length: PIN_LENGTH })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error && <FormError>{tError(state.error)}</FormError>}

      {/* Без токена в ссылке активация идёт по коду, который менеджер продиктовал лично */}
      {!token && (
        <>
          <Field label={t('email')} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label={t('code')} htmlFor="code">
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              required
              className="uppercase tracking-widest"
            />
          </Field>
        </>
      )}

      {knownEmail && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{knownEmail}</span>
        </p>
      )}

      <Field
        label={t('password')}
        htmlFor="password"
        error={state.fieldErrors?.password && validationText(state.fieldErrors.password)}
        hint={validationText('passwordTooShort')}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus={Boolean(token)}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Field
        label={t('passwordConfirm')}
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
          aria-invalid={Boolean(state.fieldErrors?.passwordConfirm)}
        />
      </Field>

      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
