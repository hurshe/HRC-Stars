'use server'

import { revalidatePath } from 'next/cache'
import { createEmployeeSchema } from '@/lib/employee-schema'
import { requirePermission } from '@/server/auth/session'
import { createEmployee, resendInvitation, setTrainerFlag } from '@/server/services/employees'

export type CreateEmployeeState = {
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

export async function createEmployeeAction(
  _prev: CreateEmployeeState,
  formData: FormData,
): Promise<CreateEmployeeState> {
  const actor = await requirePermission('employee.create')

  const raw = Object.fromEntries(formData)
  const parsed = createEmployeeSchema.safeParse({
    ...raw,
    // Позиций может быть несколько, из FormData они приходят по одному значению
    positionIds: formData.getAll('positionIds').filter(Boolean),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'form')
      fieldErrors[field] ??= issue.message
    }
    return { fieldErrors }
  }

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
