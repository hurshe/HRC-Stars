'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission, requireUser } from '@/server/auth/session'
import {
  allocateToManager,
  approveVoucherRequest,
  grantWildCards,
  markVoucherUsed,
  rejectVoucherRequest,
  requestVoucher,
} from '@/server/services/wildcards'

export type WildCardFormState = { error?: string; granted?: number }

export async function grantWildCardsAction(
  _prev: WildCardFormState,
  formData: FormData,
): Promise<WildCardFormState> {
  const actor = await requirePermission('wildcard.grant')

  const reason = String(formData.get('reason') ?? '').trim()
  // Причина обязательна: без неё выдача превращается в раздачу без смысла
  if (!reason) return { error: 'invalidAmount' }

  const result = await grantWildCards(actor, {
    userId: String(formData.get('userId') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    reason,
    note: String(formData.get('note') ?? '') || undefined,
  })

  if (!result.ok) return { error: result.error }

  revalidatePath('/wildcards')
  return { granted: Number(formData.get('amount') ?? 0) }
}

export async function allocateToManagerAction(
  _prev: WildCardFormState,
  formData: FormData,
): Promise<WildCardFormState> {
  const actor = await requirePermission('wildcard.allocate')

  const result = await allocateToManager(actor, {
    managerId: String(formData.get('managerId') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    note: String(formData.get('note') ?? '') || undefined,
  })

  if (!result.ok) return { error: result.error }

  revalidatePath('/wildcards')
  return { granted: Number(formData.get('amount') ?? 0) }
}

export async function requestVoucherAction(voucherTypeId: string) {
  const actor = await requireUser()
  const result = await requestVoucher(actor, voucherTypeId)
  revalidatePath('/wildcards')
  return result
}

export async function decideVoucherAction(requestId: string, approve: boolean, note?: string) {
  const actor = await requirePermission('wildcard.request.approve')
  const result = approve
    ? await approveVoucherRequest(actor, requestId)
    : await rejectVoucherRequest(actor, requestId, note)

  revalidatePath('/wildcards')
  return result
}

export async function markVoucherUsedAction(requestId: string) {
  const actor = await requirePermission('wildcard.request.approve')
  const result = await markVoucherUsed(actor, requestId)
  revalidatePath('/wildcards')
  return result
}
