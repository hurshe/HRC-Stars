import { compare } from 'bcryptjs'
import { db } from '@/lib/db'

/// Коды ошибок совпадают с ключами в messages/*.json — сообщение подбирает интерфейс,
/// сервер не занимается текстами и не знает про язык пользователя.
export type AuthFailure =
  | 'invalidCredentials'
  | 'invalidPin'
  | 'accountInactive'
  | 'accountArchived'
  | 'accountLocked'
  | 'notActivated'
  | 'guestExpired'

export type AuthResult =
  | { ok: true; userId: string; mustChangePassword: boolean; locale: string }
  | { ok: false; error: AuthFailure; lockedMinutes?: number }

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

/// Проверки, общие для входа по паролю и по PIN.
function checkAccountState(user: {
  status: string
  passwordHash: string | null
  lockedUntil: Date | null
  guestUntil: Date | null
  deletedAt: Date | null
}): { error: AuthFailure; lockedMinutes?: number } | null {
  if (user.deletedAt) return { error: 'invalidCredentials' }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const lockedMinutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000))
    return { error: 'accountLocked', lockedMinutes }
  }

  switch (user.status) {
    case 'INVITED':
      return { error: 'notActivated' }
    case 'SUSPENDED':
      return { error: 'accountInactive' }
    case 'ARCHIVED':
      return { error: 'accountArchived' }
  }

  // Гостевые учётки MIT закрываются автоматически по дате окончания стажировки
  if (user.guestUntil && user.guestUntil < new Date()) {
    return { error: 'guestExpired' }
  }

  return null
}

async function registerFailedAttempt(userId: string, current: number) {
  const attempts = current + 1
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil:
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : null,
    },
  })
}

async function registerSuccess(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
}

export async function verifyPassword(email: string, password: string): Promise<AuthResult> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      locale: true,
      mustChangePassword: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      guestUntil: true,
      deletedAt: true,
    },
  })

  // Отвечаем одинаково и когда пользователя нет, и когда пароль неверный:
  // иначе по разнице ответов можно перебрать, какие адреса заведены в системе.
  if (!user) return { ok: false, error: 'invalidCredentials' }

  const stateError = checkAccountState(user)
  if (stateError) return { ok: false, ...stateError }

  if (!user.passwordHash) return { ok: false, error: 'notActivated' }

  const valid = await compare(password, user.passwordHash)
  if (!valid) {
    await registerFailedAttempt(user.id, user.failedLoginAttempts)
    return { ok: false, error: 'invalidCredentials' }
  }

  await registerSuccess(user.id)
  return {
    ok: true,
    userId: user.id,
    mustChangePassword: user.mustChangePassword,
    locale: user.locale,
  }
}

/// Вход по PIN для планшета на точке.
/// PIN хранится хешем, поэтому найти пользователя по нему одним запросом нельзя —
/// перебираем только тех, у кого PIN вообще установлен. На масштабе одной локации
/// это десятки записей; если станет больше, добавим короткий несекретный префикс-индекс.
export async function verifyPin(pin: string): Promise<AuthResult> {
  const candidates = await db.user.findMany({
    where: { pinHash: { not: null }, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      pinHash: true,
      passwordHash: true,
      status: true,
      locale: true,
      mustChangePassword: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      guestUntil: true,
      deletedAt: true,
    },
  })

  for (const user of candidates) {
    if (!user.pinHash) continue
    if (!(await compare(pin, user.pinHash))) continue

    const stateError = checkAccountState(user)
    if (stateError) return { ok: false, ...stateError }

    await registerSuccess(user.id)
    return {
      ok: true,
      userId: user.id,
      mustChangePassword: user.mustChangePassword,
      locale: user.locale,
    }
  }

  return { ok: false, error: 'invalidPin' }
}
