'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/employee-schema'
import { requirePermission } from '@/server/auth/session'
import {
  createEmployee,
  resendInvitation,
  setTrainerFlag,
  updateEmployee,
} from '@/server/services/employees'

export type EmployeeFormState = {
  error?: string
  fieldErrors?: Record<string, string>
  created?: {
    userId: string
    email: string
    invitationUrl?: string
    activationCode?: string
    emailSent?: boolean
  }
}

/// Ошибки zod раскладываются по полям формы: сообщение — это код,
/// который интерфейс переводит сам
function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = String(issue.path[0] ?? 'form')
    fieldErrors[field] ??= issue.message
  }
  return fieldErrors
}

export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const actor = await requirePermission('employee.create')

  const raw = Object.fromEntries(formData)
  const parsed = createEmployeeSchema.safeParse({
    ...raw,
    // Позиций может быть несколько, из FormData они приходят по одному значению
    positionIds: formData.getAll('positionIds').filter(Boolean),
  })

  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error.issues) }

  const result = await createEmployee(actor, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidatePath('/employees')

  return {
    created: {
      userId: result.userId,
      email: parsed.data.email,
      invitationUrl: result.invitationUrl,
      activationCode: result.activationCode,
      emailSent: result.emailSent,
    },
  }
}

export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const actor = await requirePermission('employee.edit')

  const parsed = updateEmployeeSchema.safeParse({
    ...Object.fromEntries(formData),
    positionIds: formData.getAll('positionIds').filter(Boolean),
  })
  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error.issues) }

  const result = await updateEmployee(actor, parsed.data)
  if (!result.ok) return { error: result.error }

  revalidatePath('/employees')
  revalidatePath(`/employees/${parsed.data.userId}`)
  redirect(`/employees/${parsed.data.userId}`)
}

export type InviteState = {
  error?: string
  invitationUrl?: string
  activationCode?: string
  emailSent?: boolean
}

export async function resendInvitationAction(
  userId: string,
  method: 'EMAIL_LINK' | 'ACTIVATION_CODE',
): Promise<InviteState> {
  const actor = await requirePermission('employee.invite')
  const result = await resendInvitation(actor, userId, method)

  if (!result.ok) return { error: result.error }

  revalidatePath(`/employees/${userId}`)
  return {
    invitationUrl: result.invitationUrl,
    activationCode: result.activationCode,
    emailSent: result.emailSent,
  }
}

export async function toggleTrainerAction(userId: string, isTrainer: boolean) {
  const actor = await requirePermission('employee.trainer.manage')
  await setTrainerFlag(actor, userId, isTrainer)
  revalidatePath(`/employees/${userId}`)
  revalidatePath('/employees')
}
