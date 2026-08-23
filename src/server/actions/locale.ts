'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, resolveLocale } from '@/i18n/config'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/server/auth/session'

/// Переключение языка. Для вошедшего сотрудника выбор запоминается в профиле,
/// чтобы язык был тот же на телефоне и на планшете, а не только в этом браузере.
export async function setLocale(value: string) {
  const locale = resolveLocale(value)

  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  })

  const user = await getCurrentUser()
  if (user && user.locale !== locale) {
    await db.user.update({ where: { id: user.id }, data: { locale } })
  }

  revalidatePath('/', 'layout')
}
