import type { ChecklistItemType, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'

/*
  Чек-листы смены.

  Прохождение привязано к «бизнес-дате», а не к моменту заполнения:
  закрытие смены уходит за полночь, и без этого закрывающий чек-лист
  попадал бы на следующий день.
*/

/// Дата смены в формате YYYY-MM-DD, без времени
export function businessDateOf(date = new Date()): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export async function listTemplates(actor: CurrentUser) {
  return db.checklistTemplate.findMany({
    where: { locationId: actor.locationId, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      category: true,
      frequency: true,
      shift: true,
      requiresVerification: true,
      position: { select: { code: true, nameEn: true, namePl: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function createTemplate(
  actor: CurrentUser,
  input: {
    name: string
    category?: string
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE'
    shift?: string
    positionId?: string
    requiresVerification: boolean
    items: { label: string; type: ChecklistItemType; required: boolean }[]
  },
) {
  const template = await db.checklistTemplate.create({
    data: {
      locationId: actor.locationId,
      name: input.name,
      category: input.category || null,
      frequency: input.frequency,
      shift: input.shift || null,
      positionId: input.positionId || null,
      requiresVerification: input.requiresVerification,
      createdById: actor.id,
      items: {
        create: input.items.map((item, index) => ({
          label: item.label,
          type: item.type,
          required: item.required,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'checklist.template.created',
    entityType: 'ChecklistTemplate',
    entityId: template.id,
    locationId: actor.locationId,
    after: { name: input.name, items: input.items.length },
  })

  return template
}

/// Сегодняшние чек-листы. Прохождение создаётся лениво — при первом открытии,
/// а не по расписанию: фоновый планировщик ради этого держать незачем,
/// а незаполненный чек-лист и так виден как отсутствующий.
export async function getTodayChecklists(actor: CurrentUser) {
  const today = businessDateOf()
  const weekday = today.getDay() === 0 ? 7 : today.getDay()

  const templates = await db.checklistTemplate.findMany({
    where: {
      locationId: actor.locationId,
      isActive: true,
      OR: [
        { frequency: 'DAILY' },
        { frequency: 'WEEKLY', weekdays: { has: weekday } },
        { frequency: 'MONTHLY' },
        { frequency: 'ONCE' },
      ],
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      category: true,
      shift: true,
      requiresVerification: true,
      _count: { select: { items: true } },
      runs: {
        where: { businessDate: today },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          _count: { select: { results: true } },
        },
      },
    },
  })

  return templates.map((template) => ({
    ...template,
    run: template.runs[0] ?? null,
  }))
}

/// Открытие чек-листа: если прохождения на сегодня ещё нет — создаём
export async function openRun(actor: CurrentUser, templateId: string) {
  const template = await db.checklistTemplate.findFirst({
    where: { id: templateId, locationId: actor.locationId, isActive: true },
    select: { id: true, shift: true },
  })
  if (!template) return null

  const businessDate = businessDateOf()

  const run = await db.checklistRun.upsert({
    where: {
      templateId_businessDate_shift: {
        templateId,
        businessDate,
        shift: template.shift ?? '',
      },
    },
    update: {},
    create: {
      templateId,
      locationId: actor.locationId,
      businessDate,
      shift: template.shift ?? '',
      status: 'IN_PROGRESS',
      assigneeId: actor.id,
      startedAt: new Date(),
    },
    select: { id: true },
  })

  return run
}

export async function getRun(actor: CurrentUser, runId: string) {
  return db.checklistRun.findFirst({
    where: { id: runId, locationId: actor.locationId },
    select: {
      id: true,
      status: true,
      businessDate: true,
      shift: true,
      submittedAt: true,
      verifiedAt: true,
      template: {
        select: {
          id: true,
          name: true,
          requiresVerification: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, label: true, hint: true, type: true, required: true },
          },
        },
      },
      results: {
        select: { itemId: true, value: true, note: true, completedAt: true },
      },
      assignee: { select: { firstName: true, lastName: true } },
      verifiedBy: { select: { firstName: true, lastName: true } },
    },
  })
}

export async function saveItemResult(
  actor: CurrentUser,
  runId: string,
  itemId: string,
  value: unknown,
  note?: string,
) {
  const run = await db.checklistRun.findFirst({
    where: { id: runId, locationId: actor.locationId },
    select: { id: true, status: true },
  })
  if (!run) return { ok: false as const }
  // Отправленный чек-лист не редактируется: иначе подпись под ним ничего не значит
  if (run.status === 'SUBMITTED' || run.status === 'VERIFIED') {
    return { ok: false as const, error: 'alreadySubmitted' as const }
  }

  await db.checklistItemResult.upsert({
    where: { runId_itemId: { runId, itemId } },
    update: {
      value: value as Prisma.InputJsonValue,
      note: note || null,
      completedById: actor.id,
      completedAt: new Date(),
    },
    create: {
      runId,
      itemId,
      value: value as Prisma.InputJsonValue,
      note: note || null,
      completedById: actor.id,
      completedAt: new Date(),
    },
  })

  return { ok: true as const }
}

export async function submitRun(actor: CurrentUser, runId: string) {
  const run = await db.checklistRun.findFirst({
    where: { id: runId, locationId: actor.locationId },
    select: {
      id: true,
      status: true,
      template: {
        select: {
          requiresVerification: true,
          items: { where: { required: true }, select: { id: true } },
        },
      },
      results: { select: { itemId: true, value: true } },
    },
  })
  if (!run) return { ok: false as const, error: 'notFound' as const }

  // Обязательные пункты должны быть заполнены, иначе чек-лист бессмысленен
  const filled = new Set(
    run.results.filter((result) => result.value !== null).map((result) => result.itemId),
  )
  const missing = run.template.items.filter((item) => !filled.has(item.id))
  if (missing.length > 0) {
    return { ok: false as const, error: 'requiredMissing' as const, missing: missing.length }
  }

  await db.checklistRun.update({
    where: { id: run.id },
    data: {
      status: run.template.requiresVerification ? 'SUBMITTED' : 'VERIFIED',
      submittedAt: new Date(),
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'checklist.submitted',
    entityType: 'ChecklistRun',
    entityId: run.id,
    locationId: actor.locationId,
  })

  return { ok: true as const }
}

export async function verifyRun(actor: CurrentUser, runId: string) {
  const run = await db.checklistRun.findFirst({
    where: { id: runId, locationId: actor.locationId, status: 'SUBMITTED' },
    select: { id: true },
  })
  if (!run) return { ok: false as const }

  await db.checklistRun.update({
    where: { id: run.id },
    data: { status: 'VERIFIED', verifiedById: actor.id, verifiedAt: new Date() },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'checklist.verified',
    entityType: 'ChecklistRun',
    entityId: run.id,
    locationId: actor.locationId,
  })

  return { ok: true as const }
}
