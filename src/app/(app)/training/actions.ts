'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission, requireUser } from '@/server/auth/session'
import {
  addQuestionToVersion,
  assignTest,
  createTest,
  publishVersion,
  recordPaperResult,
  startAttempt,
  submitAttempt,
} from '@/server/services/tests'

export type TrainingFormState = { error?: string; fieldErrors?: Record<string, string> }

const createTestSchema = z.object({
  title: z.string().trim().min(1, { message: 'required' }).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(80).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).optional(),
  passThreshold: z.coerce.number().int().min(1).max(100).optional(),
})

export async function createTestAction(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requirePermission('test.create')

  const raw = Object.fromEntries(formData)
  const parsed = createTestSchema.safeParse({
    ...raw,
    // Пустые числовые поля из формы приходят как "", а не как отсутствие значения
    timeLimitMinutes: raw.timeLimitMinutes || undefined,
    passThreshold: raw.passThreshold || undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    }
    return { fieldErrors }
  }

  const test = await createTest(actor, parsed.data)
  revalidatePath('/training')
  redirect(`/training/tests/${test.id}`)
}

/// Варианты и правильный ответ вводятся текстом: строка на вариант,
/// номера правильных через запятую. Это заметно быстрее, чем нажимать
/// «добавить вариант» на каждый пункт, а менеджер работает с этим часто.
function parseQuestion(formData: FormData) {
  const type = String(formData.get('type') ?? 'SINGLE_CHOICE')
  const optionLines = String(formData.get('options') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const rawAnswer = String(formData.get('answer') ?? '').trim()

  if (type === 'TRUE_FALSE') {
    return { options: ['true', 'false'], answer: rawAnswer.toLowerCase() === 'true' ? 'true' : 'false' }
  }

  if (type === 'SHORT_TEXT') {
    return {
      options: [],
      answer: rawAnswer.split(',').map((value) => value.trim()).filter(Boolean),
    }
  }

  // Пользователь вводит номера с единицы, внутри храним индексы
  const toIndex = (value: string) => String(Number(value.trim()) - 1)

  if (type === 'MULTIPLE_CHOICE') {
    return { options: optionLines, answer: rawAnswer.split(',').map(toIndex) }
  }

  if (type === 'ORDERING') {
    return { options: optionLines, answer: rawAnswer.split(',').map(toIndex) }
  }

  return { options: optionLines, answer: toIndex(rawAnswer) }
}

export async function addQuestionAction(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requirePermission('test.edit')

  const testVersionId = String(formData.get('testVersionId') ?? '')
  const text = String(formData.get('text') ?? '').trim()
  if (!text) return { fieldErrors: { text: 'required' } }

  const { options, answer } = parseQuestion(formData)
  const type = String(formData.get('type') ?? 'SINGLE_CHOICE') as never

  if (Array.isArray(answer) ? answer.length === 0 : !answer) {
    return { error: 'invalidAnswer' }
  }

  const result = await addQuestionToVersion(actor, testVersionId, {
    type,
    text,
    options,
    answer,
    points: Number(formData.get('points') ?? 1) || 1,
    explanation: String(formData.get('explanation') ?? '') || undefined,
  })

  if (!result) return { error: 'notFound' }
  if (result.locked) return { error: 'locked' }

  revalidatePath(`/training/tests/${formData.get('testId')}`)
  return {}
}

export async function publishVersionAction(testId: string, testVersionId: string) {
  const actor = await requirePermission('test.edit')
  const result = await publishVersion(actor, testVersionId)
  revalidatePath(`/training/tests/${testId}`)
  return result
}

export async function assignTestAction(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requirePermission('test.assign')
  const testId = String(formData.get('testId') ?? '')
  const target = String(formData.get('target') ?? '')
  const [kind, id] = target.split(':')
  if (!kind || !id) return { error: 'notFound' }

  await assignTest(actor, testId, {
    positionId: kind === 'position' ? id : undefined,
    roleId: kind === 'role' ? id : undefined,
    userId: kind === 'user' ? id : undefined,
    dueAt: String(formData.get('dueAt') ?? '') || undefined,
    mandatory: formData.get('mandatory') === 'on',
    repeatEveryDays: Number(formData.get('repeatEveryDays') ?? 0) || undefined,
  })

  revalidatePath(`/training/tests/${testId}`)
  return {}
}

export async function recordPaperResultAction(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const actor = await requirePermission('test.result.enter')

  const result = await recordPaperResult(actor, {
    testVersionId: String(formData.get('testVersionId') ?? ''),
    userId: String(formData.get('userId') ?? ''),
    score: Number(formData.get('score') ?? 0),
    date: String(formData.get('date') ?? '') || undefined,
    note: String(formData.get('note') ?? '') || undefined,
  })

  if (!result) return { error: 'notFound' }

  revalidatePath(`/training/tests/${formData.get('testId')}`)
  revalidatePath('/training/matrix')
  return {}
}

export async function startAttemptAction(testId: string) {
  const actor = await requireUser()
  const result = await startAttempt(actor, testId)
  if (!result.ok) return result
  redirect(`/training/attempt/${result.attemptId}`)
}

export async function submitAttemptAction(attemptId: string, answers: Record<string, unknown>) {
  const actor = await requireUser()
  const result = await submitAttempt(actor, attemptId, answers)
  if (!result) return { ok: false as const }

  revalidatePath(`/training/attempt/${attemptId}`)
  revalidatePath('/training/matrix')
  return { ok: true as const, ...result }
}
