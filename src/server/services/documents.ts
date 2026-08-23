import type { DocumentSpace, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { PermissionCode } from '@/lib/permissions'
import { getPermissions, type CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'
import { buildKey, uploadFile } from './storage'

export const DOCUMENT_SPACES = ['HR', 'TRAINING', 'RECIPES', 'GENERAL'] as const

/// Доступ зависит от пространства. HR-документы — это договоры и медкнижки,
/// поэтому они закрыты тем же правом, что и остальные персональные данные,
/// а не общим правом на документы.
export function permissionForSpace(space: DocumentSpace): PermissionCode {
  return space === 'HR' ? 'personal_data.view' : 'document.view'
}

export async function canAccessSpace(actor: CurrentUser, space: DocumentSpace): Promise<boolean> {
  const permissions = await getPermissions(actor.id)
  return permissions.has(permissionForSpace(space))
}

export type DocumentFilters = {
  space: DocumentSpace
  categoryId?: string
  search?: string
}

export async function listDocuments(actor: CurrentUser, filters: DocumentFilters) {
  if (!(await canAccessSpace(actor, filters.space))) return []

  const where: Prisma.DocumentWhereInput = {
    locationId: actor.locationId,
    space: filters.space,
    deletedAt: null,
  }

  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { tags: { has: filters.search.toLowerCase() } },
    ]
  }

  return db.document.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      tags: true,
      validUntil: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      currentVersion: {
        select: { id: true, versionNumber: true, fileName: true, fileSize: true, createdAt: true },
      },
      _count: { select: { assignments: true, versions: true } },
    },
  })
}

export async function getDocument(actor: CurrentUser, id: string) {
  const document = await db.document.findFirst({
    where: { id, locationId: actor.locationId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      space: true,
      kind: true,
      tags: true,
      validUntil: true,
      createdAt: true,
      updatedAt: true,
      currentVersionId: true,
      category: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          fileKey: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          content: true,
          changeNote: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
          _count: { select: { acknowledgements: true } },
        },
      },
      assignments: {
        select: {
          id: true,
          dueAt: true,
          requiresAcknowledgement: true,
          user: { select: { id: true, firstName: true, lastName: true } },
          role: { select: { code: true } },
          position: { select: { code: true, nameEn: true, namePl: true } },
        },
      },
    },
  })

  if (!document) return null
  if (!(await canAccessSpace(actor, document.space))) return null
  return document
}

export type CreateDocumentInput = {
  space: DocumentSpace
  title: string
  description?: string
  categoryId?: string
  tags: string[]
  validUntil?: string
  content?: string
  file?: { buffer: Buffer; name: string; type: string; size: number }
}

export async function createDocument(actor: CurrentUser, input: CreateDocumentInput) {
  const kind = input.file ? 'FILE' : 'RICH_TEXT'

  let fileKey: string | undefined
  if (input.file) {
    fileKey = buildKey(`documents/${actor.locationId}`, input.file.name)
    await uploadFile({ key: fileKey, body: input.file.buffer, contentType: input.file.type })
  }

  // Документ и первая версия создаются вместе: документа без версии
  // не существует, и промежуточное состояние никому не нужно
  const document = await db.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        locationId: actor.locationId,
        space: input.space,
        categoryId: input.categoryId || null,
        title: input.title,
        description: input.description || null,
        kind,
        tags: input.tags,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        createdById: actor.id,
      },
    })

    const version = await tx.documentVersion.create({
      data: {
        documentId: created.id,
        versionNumber: 1,
        fileKey,
        fileName: input.file?.name,
        fileSize: input.file?.size,
        mimeType: input.file?.type,
        content: input.content || null,
        authorId: actor.id,
      },
    })

    return tx.document.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
      select: { id: true },
    })
  })

  await writeAudit({
    actorId: actor.id,
    action: 'document.created',
    entityType: 'Document',
    entityId: document.id,
    locationId: actor.locationId,
    isSensitive: input.space === 'HR',
    after: { title: input.title, space: input.space, kind },
  })

  return document
}

/// Новая версия не затирает старую: у прочитавших прежнюю версию
/// подтверждение остаётся привязанным именно к ней
export async function addDocumentVersion(
  actor: CurrentUser,
  documentId: string,
  input: { changeNote?: string; content?: string; file?: CreateDocumentInput['file'] },
) {
  const document = await db.document.findFirst({
    where: { id: documentId, locationId: actor.locationId, deletedAt: null },
    select: { id: true, space: true, versions: { select: { versionNumber: true }, orderBy: { versionNumber: 'desc' }, take: 1 } },
  })
  if (!document) return null

  let fileKey: string | undefined
  if (input.file) {
    fileKey = buildKey(`documents/${actor.locationId}`, input.file.name)
    await uploadFile({ key: fileKey, body: input.file.buffer, contentType: input.file.type })
  }

  const nextNumber = (document.versions[0]?.versionNumber ?? 0) + 1

  const version = await db.$transaction(async (tx) => {
    const created = await tx.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextNumber,
        fileKey,
        fileName: input.file?.name,
        fileSize: input.file?.size,
        mimeType: input.file?.type,
        content: input.content || null,
        changeNote: input.changeNote || null,
        authorId: actor.id,
      },
    })
    await tx.document.update({ where: { id: documentId }, data: { currentVersionId: created.id } })
    return created
  })

  await writeAudit({
    actorId: actor.id,
    action: 'document.version.added',
    entityType: 'Document',
    entityId: documentId,
    locationId: actor.locationId,
    after: { versionNumber: nextNumber },
  })

  return version
}

export async function assignDocument(
  actor: CurrentUser,
  documentId: string,
  target: { userId?: string; roleId?: string; positionId?: string; dueAt?: string; requiresAcknowledgement: boolean },
) {
  const assignment = await db.documentAssignment.create({
    data: {
      documentId,
      userId: target.userId || null,
      roleId: target.roleId || null,
      positionId: target.positionId || null,
      dueAt: target.dueAt ? new Date(target.dueAt) : null,
      requiresAcknowledgement: target.requiresAcknowledgement,
      createdById: actor.id,
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'document.assigned',
    entityType: 'Document',
    entityId: documentId,
    locationId: actor.locationId,
    after: target as unknown as Prisma.InputJsonValue,
  })

  return assignment
}

/// Что назначено конкретному сотруднику: напрямую, по роли или по позиции
export async function listAssignedDocuments(actor: CurrentUser) {
  const positionIds = actor.positions.map((position) => position.code)

  const assignments = await db.documentAssignment.findMany({
    where: {
      document: { locationId: actor.locationId, deletedAt: null },
      OR: [
        { userId: actor.id },
        { role: { code: actor.role.code } },
        { position: { code: { in: positionIds } } },
      ],
    },
    select: {
      id: true,
      dueAt: true,
      requiresAcknowledgement: true,
      document: {
        select: {
          id: true,
          title: true,
          space: true,
          currentVersionId: true,
          currentVersion: { select: { id: true, versionNumber: true } },
        },
      },
    },
  })

  // Подтверждение привязано к версии: после выхода новой версии документ
  // снова считается непрочитанным, и это правильно
  const versionIds = assignments
    .map((assignment) => assignment.document.currentVersionId)
    .filter((id): id is string => Boolean(id))

  const acknowledged = await db.documentAcknowledgement.findMany({
    where: { userId: actor.id, documentVersionId: { in: versionIds } },
    select: { documentVersionId: true, acknowledgedAt: true },
  })
  const ackMap = new Map(acknowledged.map((a) => [a.documentVersionId, a.acknowledgedAt]))

  return assignments.map((assignment) => ({
    ...assignment,
    acknowledgedAt: assignment.document.currentVersionId
      ? (ackMap.get(assignment.document.currentVersionId) ?? null)
      : null,
  }))
}

export async function acknowledgeDocument(actor: CurrentUser, documentVersionId: string) {
  await db.documentAcknowledgement.upsert({
    where: { documentVersionId_userId: { documentVersionId, userId: actor.id } },
    update: {},
    create: { documentVersionId, userId: actor.id },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'document.acknowledged',
    entityType: 'DocumentVersion',
    entityId: documentVersionId,
    locationId: actor.locationId,
  })
}

export async function listCategories(space: DocumentSpace) {
  return db.documentCategory.findMany({
    where: { space, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
}
