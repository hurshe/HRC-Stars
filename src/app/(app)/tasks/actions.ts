'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { TaskStatus } from '@prisma/client'
import { requirePermission, requireUser } from '@/server/auth/session'
import { addTaskComment, changeTaskStatus, createTask } from '@/server/services/tasks'

export type TaskFormState = { error?: string; fieldErrors?: Record<string, string> }

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const actor = await requirePermission('task.create')

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { fieldErrors: { title: 'required' } }

  const result = await createTask(actor, {
    title,
    description: String(formData.get('description') ?? '') || undefined,
    target: String(formData.get('target') ?? ''),
    dueAt: String(formData.get('dueAt') ?? '') || undefined,
    priority: (String(formData.get('priority') ?? 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH'),
    requiresApproval: formData.get('requiresApproval') === 'on',
    repeatEveryDays: Number(formData.get('repeatEveryDays') ?? 0) || undefined,
  })

  if (!result.ok) return { error: result.error }

  revalidatePath('/tasks')
  redirect(`/tasks/${result.taskId}`)
}

export async function changeTaskStatusAction(taskId: string, status: TaskStatus) {
  const actor = await requireUser()
  const result = await changeTaskStatus(actor, taskId, status)

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return result
}

export async function addTaskCommentAction(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const actor = await requireUser()
  const taskId = String(formData.get('taskId') ?? '')
  const text = String(formData.get('text') ?? '').trim()
  if (!text) return { fieldErrors: { text: 'required' } }

  const result = await addTaskComment(actor, taskId, text)
  if (!result.ok) return { error: 'notFound' }

  revalidatePath(`/tasks/${taskId}`)
  return {}
}
