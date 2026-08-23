'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input } from '@/components/ui/field'
import { PIN_LENGTH } from '@/lib/validation'
import { signInWithPin, type FormState } from '../actions'

const initialState: FormState = {}

export function PinForm() {
  const t = useTranslations('auth.pin')
  const tError = useTranslations('auth.errors')
  const [state, formAction, pending] = useActionState(signInWithPin, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <FormError>{tError(state.error, state.errorParams ?? {})}</FormError>}

      <Field label={t('label')} htmlFor="pin">
        <Input
          id="pin"
          name="pin"
          type="password"
          // Цифровая клавиатура на планшете и телефоне вместо буквенной
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={PIN_LENGTH}
          autoComplete="one-time-code"
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
          className="text-center text-2xl tracking-[0.4em]"
        />
      </Field>

      <Button type="submit" block size="lg" disabled={pending}>
        {t('submit')}
      </Button>

      <p className="pt-2 text-center">
        <Link href="/login" className="text-sm text-text-muted underline underline-offset-4 hover:text-text">
          {t('passwordLink')}
        </Link>
      </p>
    </form>
  )
}
