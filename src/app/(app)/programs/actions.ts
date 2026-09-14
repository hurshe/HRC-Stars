'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ProgramStepType, ProgramType } from '@prisma/client'
import { requirePermission, requireUser } from '@/server/auth/session'
import {
  acknowledgeStepDocument,
  addProgramStep,
  cancelEnrollment,
  completeEnrollment,
  createProgram,
  enrollInProgram,
  moveProgramStep,
  removeProgramStep,
  setPracticeStep,
  setProgramActive,
} from '@/server/services/programs'

export type ProgramFormState = { error?: string; fieldErrors?: Record<string, string> }

const PROGRAM_TYPES: readonly ProgramType[] = ['ONBOARDING', 'MIT', 'CUSTOM']
const STEP_TYPES: readonly ProgramStepType[] = ['DOCUMENT', 'TEST', 'PRACTICE']

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

export async function createProgramAction(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const actor = await requirePermission('program.manage')

  const name = field(formData, 'name')
  if (!name) return { fieldErrors: { name: 'required' } }

  const type = field(formData, 'type') as ProgramType
  if (!PROGRAM_TYPES.includes(type)) return { error: 'invalidType' }

  const result = await createProgram(actor, {
    name,
    type,
    description: field(formData, 'description') || undefined,
    positionId: field(formData, 'positionId') || undefined,
  })
  if (!result.ok) return { error: result.error }

  revalidatePath('/programs/all')
  redirect(`/programs/${result.programId}`)
}

export async function setProgramActiveAction(programId: string, isActive: boolean) {
  const actor = await requirePermission('program.manage')
  const result = await setProgramActive(actor, programId, isActive)

  revalidatePath('/programs/all')
  revalidatePath(`/programs/${programId}`)
  return result
}

export async function addStepAction(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const actor = await requirePermission('program.manage')
  const programId = field(formData, 'programId')

  const type = field(formData, 'type') as ProgramStepType
  if (!STEP_TYPES.includes(type)) return { error: 'invalidType' }

  // У документа и теста свои списки выбора — берём значение нужного
  const refId =
    type === 'DOCUMENT'
      ? field(formData, 'documentId')
      : type === 'TEST'
        ? field(formData, 'testId')
        : ''

  const result = await addProgramStep(actor, programId, {
    type,
    title: field(formData, 'title'),
    refId: refId || undefined,
    required: formData.get('required') === 'on',
  })
  if (!result.ok) return { error: result.error }

  revalidatePath(`/programs/${programId}`)
  return {}
}

export async function removeStepAction(stepId: string) {
  const actor = await requirePermission('program.manage')
  const result = await removeProgramStep(actor, stepId)
  if (result.ok) revalidatePath(`/programs/${result.programId}`)
  return result
}

export async function moveStepAction(stepId: string, direction: 'up' | 'down') {
  const actor = await requirePermission('program.manage')
  const result = await moveProgramStep(actor, stepId, direction)
  if (result.ok) revalidatePath(`/programs/${result.programId}`)
  return result
}

export async function enrollAction(
  _prev: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  const actor = await requirePermission('program.enroll')
  const programId = field(formData, 'programId')

  const userId = field(formData, 'userId')
  if (!userId) return { fieldErrors: { userId: 'required' } }

  const result = await enrollInProgram(actor, {
    programId,
    userId,
    mentorId: field(formData, 'mentorId') || undefined,
    dueAt: field(formData, 'dueAt') || undefined,
  })
  if (!result.ok) return { error: result.error }

  revalidatePath(`/programs/${programId}`)
  return {}
}

export async function cancelEnrollmentAction(enrollmentId: string) {
  const actor = await requirePermission('program.enroll')
  const result = await cancelEnrollment(actor, enrollmentId)
  if (!result.ok) return result

  revalidatePath(`/programs/${result.programId}`)
  redirect(`/programs/${result.programId}`)
}

export async function setPracticeStepAction(enrollmentId: string, stepId: string, done: boolean) {
  const actor = await requireUser()
  const result = await setPracticeStep(actor, { enrollmentId, stepId, done })

  revalidatePath(`/programs/enrollments/${enrollmentId}`)
  return result
}

export async function acknowledgeStepAction(enrollmentId: string, stepId: string) {
  const actor = await requireUser()
  const result = await acknowledgeStepDocument(actor, enrollmentId, stepId)

  revalidatePath(`/programs/enrollments/${enrollmentId}`)
  revalidatePath('/programs')
  return result
}

export async function completeEnrollmentAction(enrollmentId: string) {
  const actor = await requirePermission('certificate.issue')
  const result = await completeEnrollment(actor, enrollmentId)

  revalidatePath(`/programs/enrollments/${enrollmentId}`)
  revalidatePath('/programs/certificates')
  return result
}
