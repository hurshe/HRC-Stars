'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { signIn } from '@/auth'
import { verifyPassword, verifyPin } from '@/server/services/authentication'
import { signInSchema, pinSignInSchema, passwordSchema } from '@/lib/validation'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, resolveLocale } from '@/i18n/config'
import {
  checkActivationCode,
  checkInvitationToken,
  completeActivation,
} from '@/server/services/invitations'

export type FormState = {
  /// Код ошибки из messages/*.json — тексты живут в интерфейсе, не на сервере
  error?: string
  errorParams?: Record<string, string | number>
  fieldErrors?: Record<string, string>
}

async function rememberLocale(locale: string) {
  const store = await cookies()
  store.set(LOCALE_COOKIE, resolveLocale(locale), {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })
}

/// Защита от открытого редиректа: принимаем только внутренние пути.
/// "//evil.com" тоже начинается со слэша, поэтому одной проверки startsWith('/') мало.
function safeRedirectTarget(value: FormDataEntryValue | null): string | null {
  const path = typeof value === 'string' ? value : ''
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}

export async function signInWithPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'invalidCredentials' }

  // Проверяем сами, чтобы показать точную причину: Auth.js по своей природе
  // маскирует все отказы провайдера под одну обезличенную ошибку.
  const result = await verifyPassword(parsed.data.email, parsed.data.password)
  if (!result.ok) {
    return {
      error: result.error,
      errorParams: result.lockedMinutes ? { minutes: result.lockedMinutes } : undefined,
    }
  }

  try {
    await signIn('password', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    console.error('[auth] signIn упал после успешной проверки пароля', error)
    return { error: 'unknown' }
  }

  await rememberLocale(result.locale)

  if (result.mustChangePassword) redirect('/change-password')
  redirect(safeRedirectTarget(formData.get('from')) ?? '/dashboard')
}

export async function signInWithPin(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = pinSignInSchema.safeParse({ pin: formData.get('pin') })
  if (!parsed.success) return { error: 'invalidPin' }

  const result = await verifyPin(parsed.data.pin)
  if (!result.ok) {
    return {
      error: result.error,
      errorParams: result.lockedMinutes ? { minutes: result.lockedMinutes } : undefined,
    }
  }

  try {
    await signIn('pin', { pin: parsed.data.pin, redirect: false })
  } catch (error) {
    console.error('[auth] вход по PIN упал после успешной проверки', error)
    return { error: 'unknown' }
  }

  await rememberLocale(result.locale)
  redirect('/dashboard')
}

export async function activateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  const passwordCheck = passwordSchema.safeParse(password)
  if (!passwordCheck.success) {
    return { fieldErrors: { password: passwordCheck.error.issues[0]?.message ?? 'required' } }
  }
  if (password !== passwordConfirm) {
    return { fieldErrors: { passwordConfirm: 'passwordsDoNotMatch' } }
  }

  const token = String(formData.get('token') ?? '')
  const email = String(formData.get('email') ?? '')
  const code = String(formData.get('code') ?? '')

  const check = token
    ? await checkInvitationToken(token)
    : await checkActivationCode(email, code)

  if (!check.ok) return { error: check.error }

  await completeActivation({
    invitationId: check.invitationId,
    userId: check.userId,
    password,
  })

  try {
    await signIn('password', { email: check.email, password, redirect: false })
  } catch (error) {
    // Пароль уже сохранён — человек просто войдёт обычной формой
    console.error('[auth] автовход после активации не удался', error)
    redirect('/login')
  }

  redirect('/dashboard')
}
