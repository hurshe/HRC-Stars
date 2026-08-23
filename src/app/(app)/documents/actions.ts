'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission, requireUser } from '@/server/auth/session'
import {
  acknowledgeDocument,
  addDocumentVersion,
  assignDocument,
  canAccessSpace,
  createDocument,
} from '@/server/services/documents'
import { checkUpload } from '@/server/services/storage'

export type DocumentFormState = { error?: string; fieldErrors?: Record<string, string> }

const createSchema = z.object({
  space: z.enum(['HR', 'TRAINING', 'RECIPES', 'GENERAL']),
  title: z.string().trim().min(1, { message: 'required' }).max(200),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
  validUntil: z.string().optional(),
  content: z.string().optional(),
})

/// Файл приходит из FormData как File. Читаем его в память: лимит 25 МБ,
/// потоковая загрузка тут не окупается сложностью
async function readUpload(formData: FormData) {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { file: undefined as undefined }

  const check = checkUpload({ size: file.size, type: file.type })
  if (!check.ok) return { error: check.error }

  return {
    file: {
      buffer: Buffer.from(await file.arrayBuffer()),
      name: file.name,
      type: file.type,
      size: file.size,
    },
  }
}

export async function createDocumentAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const actor = await requirePermission('document.create')

  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    }
    return { fieldErrors }
  }

  // Право на раздел проверяется отдельно от права на создание:
  // HR-документы закрыты тем же правом, что и остальные персданные
  if (!(await canAccessSpace(actor, parsed.data.space))) return { error: 'notFound' }

  const upload = await readUpload(formData)
  if ('error' in upload && upload.error) return { error: upload.error }

  const content = parsed.data.content?.trim()
  if (!upload.file && !content) return { error: 'fileOrContentRequired' }

  const document = await createDocument(actor, {
    space: parsed.data.space,
    title: parsed.data.title,
    description: parsed.data.description,
    categoryId: parsed.data.categoryId,
    tags: (parsed.data.tags ?? '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    validUntil: parsed.data.validUntil,
    content,
    file: upload.file,
  })

  revalidatePath('/documents')
  redirect(`/documents/${document.id}`)
}

export async function addVersionAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const actor = await requirePermission('document.edit')
  const documentId = String(formData.get('documentId') ?? '')

  const upload = await readUpload(formData)
  if ('error' in upload && upload.error) return { error: upload.error }

  const content = String(formData.get('content') ?? '').trim()
  if (!upload.file && !content) return { error: 'fileOrContentRequired' }

  const version = await addDocumentVersion(actor, documentId, {
    changeNote: String(formData.get('changeNote') ?? '') || undefined,
    content: content || undefined,
    file: upload.file,
  })
  if (!version) return { error: 'notFound' }

  revalidatePath(`/documents/${documentId}`)
  return {}
}

export async function assignDocumentAction(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const actor = await requirePermission('document.assign')
  const documentId = String(formData.get('documentId') ?? '')
  const target = String(formData.get('target') ?? '')

  // Одно поле в форме, но три возможных получателя: чтобы менеджер
  // не выбирал «тип получателя» отдельным шагом
  const [kind, id] = target.split(':')
  if (!kind || !id) return { error: 'notFound' }

  await assignDocument(actor, documentId, {
    userId: kind === 'user' ? id : undefined,
    roleId: kind === 'role' ? id : undefined,
    positionId: kind === 'position' ? id : undefined,
    dueAt: String(formData.get('dueAt') ?? '') || undefined,
    requiresAcknowledgement: formData.get('requiresAcknowledgement') === 'on',
  })

  revalidatePath(`/documents/${documentId}`)
  return {}
}

export async function acknowledgeDocumentAction(documentVersionId: string) {
  const actor = await requireUser()
  await acknowledgeDocument(actor, documentVersionId)
  revalidatePath('/documents/my')
  revalidatePath('/dashboard')
}
