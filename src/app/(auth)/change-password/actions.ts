'use server'

import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { requireUser } from '@/server/auth/session'
import { verifyPassword } from '@/server/services/authentication'
import { passwordSchema } from '@/lib/validation'
import { writeAudit } from '@/server/services/audit'
import type { FormState } from '../actions'

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()

  const currentPassword = String(formData.get('currentPassword') ?? '')
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '')

  const passwordCheck = passwordSchema.safeParse(password)
  if (!passwordCheck.success) {
    return { fieldErrors: { password: passwordCheck.error.issues[0]?.message ?? 'required' } }
  }
  if (password !== passwordConfirm) {
    return { fieldErrors: { passwordConfirm: 'passwordsDoNotMatch' } }
  }

  // Проверка текущего пароля идёт через тот же сервис, что и вход,
  // поэтому подбор старого пароля так же упирается в блокировку после 5 попыток.
  const check = await verifyPassword(user.email, currentPassword)
  if (!check.ok) {
    return {
      error: check.error,
      errorParams: check.lockedMinutes ? { minutes: check.lockedMinutes } : undefined,
    }
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(password, 12), mustChangePassword: false },
  })

  await writeAudit({
    actorId: user.id,
    action: 'user.password.changed',
    entityType: 'User',
    entityId: user.id,
    locationId: user.locationId,
  })

  redirect('/dashboard')
}
