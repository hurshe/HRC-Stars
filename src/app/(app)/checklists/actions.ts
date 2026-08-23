'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ChecklistItemType } from '@prisma/client'
import { requirePermission } from '@/server/auth/session'
import {
  createTemplate,
  openRun,
  saveItemResult,
  submitRun,
  verifyRun,
} from '@/server/services/checklists'

export type ChecklistFormState = { error?: string; missing?: number }

export async function openRunAction(templateId: string) {
  const actor = await requirePermission('checklist.run')
  const run = await openRun(actor, templateId)
  if (!run) return { ok: false as const }
  redirect(`/checklists/run/${run.id}`)
}

export async function saveItemAction(runId: string, itemId: string, value: unknown, note?: string) {
  const actor = await requirePermission('checklist.run')
  const result = await saveItemResult(actor, runId, itemId, value, note)
  // Полный revalidate на каждую галочку сделал бы заполнение медленным:
  // страница сама держит состояние, серверу достаточно сохранить значение
  return result
}

export async function submitRunAction(runId: string): Promise<ChecklistFormState & { ok?: boolean }> {
  const actor = await requirePermission('checklist.run')
  const result = await submitRun(actor, runId)

  revalidatePath('/checklists')
  revalidatePath(`/checklists/run/${runId}`)

  if (!result.ok) return { error: result.error, missing: result.missing }
  return { ok: true }
}

export async function verifyRunAction(runId: string) {
  const actor = await requirePermission('checklist.verify')
  const result = await verifyRun(actor, runId)

  revalidatePath('/checklists')
  revalidatePath(`/checklists/run/${runId}`)
  return result
}

export async function createTemplateAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const actor = await requirePermission('checklist.template.manage')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'notFound' }

  // Пункты вводятся построчно: так шаблон из двадцати позиций
  // заводится за минуту, а не за двадцать нажатий «добавить»
  const items = String(formData.get('items') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      type: 'CHECKBOX' as ChecklistItemType,
      required: true,
    }))

  if (items.length === 0) return { error: 'requiredMissing' }

  await createTemplate(actor, {
    name,
    category: String(formData.get('category') ?? '') || undefined,
    frequency: String(formData.get('frequency') ?? 'DAILY') as 'DAILY',
    shift: String(formData.get('shift') ?? '') || undefined,
    positionId: String(formData.get('positionId') ?? '') || undefined,
    requiresVerification: formData.get('requiresVerification') === 'on',
    items,
  })

  revalidatePath('/checklists')
  redirect('/checklists')
}
