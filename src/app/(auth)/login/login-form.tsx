'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input } from '@/components/ui/field'
import { signInWithPassword, type FormState } from '../actions'

const initialState: FormState = {}

export function LoginForm({ from }: { from: string }) {
  const t = useTranslations('auth.signIn')
  const tError = useTranslations('auth.errors')
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {from && <input type="hidden" name="from" value={from} />}

      {state.error && (
        <FormError>{tError(state.error, state.errorParams ?? {})}</FormError>
      )}

      <Field label={t('email')} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          aria-invalid={Boolean(state.error)}
        />
      </Field>

      <Field label={t('password')} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
        />
      </Field>

      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </Button>

      <p className="pt-2 text-center">
        <Link href="/pin" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {t('pinLink')}
        </Link>
      </p>
    </form>
  )
}
