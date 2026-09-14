import type { ProgramStepType, ProgramType } from '@prisma/client'
import { db } from '@/lib/db'
import { getPermissions, outranks, type CurrentUser } from '@/server/auth/session'
import { renderCertificatePdf } from '@/server/pdf/certificate'
import { writeAudit } from './audit'
import { acknowledgeDocument } from './documents'
import { buildKey, deleteFile, getDownloadUrl, uploadFile } from './storage'

/*
  Программы обучения и сертификаты.

  Прогресс по шагам не хранится, а вычисляется из данных соседних модулей:
  шаг-документ засчитан, если участник подтвердил прочтение текущей версии,
  шаг-тест — если есть зачтённая попытка. Вручную отмечаются только
  практические шаги. Храни мы отметки отдельно, они разошлись бы с модулями
  документов и тестов при первой же новой версии документа.

  Сертификат выдаётся явным действием: нажатие кнопки и есть подпись
  выдающего. Автоматическая выдача по последнему шагу выпускала бы
  «подписанные» документы, которые никто не подписывал.
*/

type StepRow = {
  id: string
  programId: string
  sortOrder: number
  type: ProgramStepType
  title: string
  refId: string | null
  required: boolean
}

export type StepState = StepRow & {
  done: boolean
  doneAt: Date | null
  /// Документ удалён или у теста нет опубликованной версии: пройти шаг нельзя,
  /// пока его не заменят
  unavailable: boolean
  verifiedBy: string | null
  note: string | null
}

export type ProgressSummary = {
  total: number
  done: number
  requiredTotal: number
  requiredDone: number
  percent: number
  /// Все обязательные шаги пройдены — можно выдавать сертификат
  ready: boolean
}

type EnrollmentRef = { id: string; userId: string; programId: string }

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}

function isOverdue(dueAt: Date | null, completedAt: Date | null, now: number): boolean {
  return Boolean(dueAt && !completedAt && dueAt.getTime() < now)
}

// ─── Вычисление прогресса ─────────────────────────────────────────────────

async function loadSteps(programIds: string[]): Promise<Map<string, StepRow[]>> {
  const byProgram = new Map<string, StepRow[]>()
  if (programIds.length === 0) return byProgram

  const steps = await db.programStep.findMany({
    where: { programId: { in: programIds } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      programId: true,
      sortOrder: true,
      type: true,
      title: true,
      refId: true,
      required: true,
    },
  })

  for (const step of steps) {
    const list = byProgram.get(step.programId) ?? []
    list.push(step)
    byProgram.set(step.programId, list)
  }
  return byProgram
}

/// Состояние шагов сразу для пачки записей: запросов к базе столько же,
/// сколько для одной, иначе список участников программы делал бы N запросов
async function computeStepStates(
  enrollments: EnrollmentRef[],
  stepsByProgram: Map<string, StepRow[]>,
): Promise<Map<string, StepState[]>> {
  const steps = [...stepsByProgram.values()].flat()
  const documentIds = unique(
    steps.filter((step) => step.type === 'DOCUMENT' && step.refId).map((step) => step.refId as string),
  )
  const testIds = unique(
    steps.filter((step) => step.type === 'TEST' && step.refId).map((step) => step.refId as string),
  )
  const userIds = unique(enrollments.map((enrollment) => enrollment.userId))
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id)

  const [documents, tests, practice] = await Promise.all([
    documentIds.length
      ? db.document.findMany({
          where: { id: { in: documentIds }, deletedAt: null },
          select: { id: true, currentVersionId: true },
        })
      : Promise.resolve([]),
    testIds.length
      ? db.test.findMany({
          where: { id: { in: testIds } },
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
            versions: { where: { isPublished: true }, take: 1, select: { id: true } },
          },
        })
      : Promise.resolve([]),
    enrollmentIds.length
      ? db.programStepProgress.findMany({
          where: { enrollmentId: { in: enrollmentIds }, completedAt: { not: null } },
          select: {
            enrollmentId: true,
            stepId: true,
            completedAt: true,
            note: true,
            completedBy: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const currentVersion = new Map(documents.map((document) => [document.id, document.currentVersionId]))
  const versionIds = documents
    .map((document) => document.currentVersionId)
    .filter((id): id is string => Boolean(id))
  const testAvailable = new Map(
    tests.map((test) => [test.id, test.isActive && !test.deletedAt && test.versions.length > 0]),
  )

  const [acknowledgements, passes] = await Promise.all([
    versionIds.length && userIds.length
      ? db.documentAcknowledgement.findMany({
          where: { userId: { in: userIds }, documentVersionId: { in: versionIds } },
          select: { userId: true, documentVersionId: true, acknowledgedAt: true },
        })
      : Promise.resolve([]),
    testIds.length && userIds.length
      ? db.testAttempt.findMany({
          // Засчитывается любая зачтённая попытка, в том числе сданная до записи
          // на программу: человек, уже сдавший Food Test, не должен пересдавать
          // его только потому, что его записали на онбординг
          where: { userId: { in: userIds }, passed: true, testVersion: { testId: { in: testIds } } },
          select: {
            userId: true,
            startedAt: true,
            submittedAt: true,
            testVersion: { select: { testId: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const acknowledgedAt = new Map(
    acknowledgements.map((ack) => [`${ack.userId}:${ack.documentVersionId}`, ack.acknowledgedAt]),
  )

  const passedAt = new Map<string, Date>()
  for (const attempt of passes) {
    const key = `${attempt.userId}:${attempt.testVersion.testId}`
    const at = attempt.submittedAt ?? attempt.startedAt
    const known = passedAt.get(key)
    // Датой шага считается первая зачтённая попытка
    if (!known || at < known) passedAt.set(key, at)
  }

  const practiceMarks = new Map(practice.map((mark) => [`${mark.enrollmentId}:${mark.stepId}`, mark]))

  const result = new Map<string, StepState[]>()
  for (const enrollment of enrollments) {
    const states = (stepsByProgram.get(enrollment.programId) ?? []).map((step): StepState => {
      if (step.type === 'DOCUMENT') {
        const versionId = step.refId ? currentVersion.get(step.refId) : undefined
        const at = versionId ? acknowledgedAt.get(`${enrollment.userId}:${versionId}`) : undefined
        return {
          ...step,
          done: Boolean(at),
          doneAt: at ?? null,
          unavailable: !versionId,
          verifiedBy: null,
          note: null,
        }
      }

      if (step.type === 'TEST') {
        const at = step.refId ? passedAt.get(`${enrollment.userId}:${step.refId}`) : undefined
        const available = step.refId ? (testAvailable.get(step.refId) ?? false) : false
        return {
          ...step,
          done: Boolean(at),
          doneAt: at ?? null,
          // Уже сданный тест засчитан, даже если потом его сняли с публикации
          unavailable: !at && !available,
          verifiedBy: null,
          note: null,
        }
      }

      const mark = practiceMarks.get(`${enrollment.id}:${step.id}`)
      return {
        ...step,
        done: Boolean(mark?.completedAt),
        doneAt: mark?.completedAt ?? null,
        unavailable: false,
        verifiedBy: mark?.completedBy
          ? `${mark.completedBy.firstName} ${mark.completedBy.lastName}`
          : null,
        note: mark?.note ?? null,
      }
    })
    result.set(enrollment.id, states)
  }

  return result
}

export function summarizeProgress(states: StepState[]): ProgressSummary {
  const required = states.filter((state) => state.required)
  const requiredDone = required.filter((state) => state.done).length
  const done = states.filter((state) => state.done).length

  // Процент считается по обязательным шагам: необязательные не должны
  // тормозить полосу прогресса у того, кто сделал всё нужное
  const basis = required.length > 0 ? required.length : states.length
  const basisDone = required.length > 0 ? requiredDone : done

  return {
    total: states.length,
    done,
    requiredTotal: required.length,
    requiredDone,
    percent: basis === 0 ? 0 : Math.round((basisDone / basis) * 100),
    ready: states.length > 0 && requiredDone === required.length,
  }
}

async function findProgram(actor: CurrentUser, programId: string) {
  return db.program.findFirst({
    where: { id: programId, locationId: actor.locationId },
    select: { id: true, name: true, isActive: true },
  })
}

// ─── Программы ────────────────────────────────────────────────────────────

export async function listPrograms(actor: CurrentUser) {
  return db.program.findMany({
    where: { locationId: actor.locationId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      isActive: true,
      createdAt: true,
      position: { select: { code: true, nameEn: true, namePl: true } },
      _count: { select: { steps: true, enrollments: true, certificates: true } },
    },
  })
}

export async function listPositionOptions() {
  return db.position.findMany({
    where: { isActive: true },
    orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: { id: true, code: true, nameEn: true, namePl: true },
  })
}

/// Списки для форм программы: материалы для шагов и люди для записи
export async function getProgramFormOptions(actor: CurrentUser) {
  const [documents, tests, people] = await Promise.all([
    db.document.findMany({
      // HR-документы личные — договор или медкнижку конкретного человека
      // в общую программу не включают
      where: { locationId: actor.locationId, deletedAt: null, space: { not: 'HR' } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
    db.test.findMany({
      where: { locationId: actor.locationId, deletedAt: null, isActive: true },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
    db.user.findMany({
      where: { locationId: actor.locationId, deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, status: true, role: { select: { level: true } } },
    }),
  ])

  const person = (user: (typeof people)[number]) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
  })

  return {
    documents,
    tests,
    // Записать можно только тех, кто ниже по иерархии; куратором — любого активного
    participants: people.filter((user) => outranks(actor, user.role.level)).map(person),
    mentors: people.filter((user) => user.status === 'ACTIVE').map(person),
  }
}

export type CreateProgramInput = {
  name: string
  description?: string
  type: ProgramType
  positionId?: string
}

export async function createProgram(actor: CurrentUser, input: CreateProgramInput) {
  if (input.positionId) {
    const position = await db.position.findUnique({
      where: { id: input.positionId },
      select: { id: true },
    })
    if (!position) return { ok: false as const, error: 'notFound' as const }
  }

  const program = await db.program.create({
    data: {
      locationId: actor.locationId,
      name: input.name,
      description: input.description || null,
      type: input.type,
      positionId: input.positionId || null,
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'program.created',
    entityType: 'Program',
    entityId: program.id,
    locationId: actor.locationId,
    after: { name: input.name, type: input.type },
  })

  return { ok: true as const, programId: program.id }
}

export async function setProgramActive(actor: CurrentUser, programId: string, isActive: boolean) {
  const program = await findProgram(actor, programId)
  if (!program) return { ok: false as const, error: 'notFound' as const }

  await db.program.update({ where: { id: program.id }, data: { isActive } })

  await writeAudit({
    actorId: actor.id,
    action: isActive ? 'program.restored' : 'program.archived',
    entityType: 'Program',
    entityId: program.id,
    locationId: actor.locationId,
  })

  return { ok: true as const }
}

export async function getProgram(actor: CurrentUser, id: string) {
  const program = await db.program.findFirst({
    where: { id, locationId: actor.locationId },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      isActive: true,
      createdAt: true,
      position: { select: { code: true, nameEn: true, namePl: true } },
      enrollments: {
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          userId: true,
          programId: true,
          startedAt: true,
          completedAt: true,
          dueAt: true,
          user: { select: { id: true, firstName: true, lastName: true } },
          mentor: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!program) return null

  const stepsByProgram = await loadSteps([program.id])
  const steps = stepsByProgram.get(program.id) ?? []
  const [states, availability] = await Promise.all([
    computeStepStates(program.enrollments, stepsByProgram),
    describeStepMaterials(steps),
  ])

  const now = Date.now()
  return {
    ...program,
    steps: steps.map((step) => ({
      ...step,
      unavailable: step.type !== 'PRACTICE' && !(step.refId && availability.get(step.refId)),
    })),
    enrollments: program.enrollments.map((enrollment) => ({
      ...enrollment,
      progress: summarizeProgress(states.get(enrollment.id) ?? []),
      overdue: isOverdue(enrollment.dueAt, enrollment.completedAt, now),
    })),
  }
}

/// Доступен ли материал шага: для редактора программы, где участников может не быть
async function describeStepMaterials(steps: StepRow[]): Promise<Map<string, boolean>> {
  const documentIds = steps.filter((s) => s.type === 'DOCUMENT' && s.refId).map((s) => s.refId as string)
  const testIds = steps.filter((s) => s.type === 'TEST' && s.refId).map((s) => s.refId as string)

  const [documents, tests] = await Promise.all([
    documentIds.length
      ? db.document.findMany({
          where: { id: { in: documentIds } },
          select: { id: true, deletedAt: true, currentVersionId: true },
        })
      : Promise.resolve([]),
    testIds.length
      ? db.test.findMany({
          where: { id: { in: testIds } },
          select: { id: true, deletedAt: true, isActive: true },
        })
      : Promise.resolve([]),
  ])

  const available = new Map<string, boolean>()
  for (const document of documents) {
    available.set(document.id, !document.deletedAt && Boolean(document.currentVersionId))
  }
  for (const test of tests) available.set(test.id, !test.deletedAt && test.isActive)
  return available
}

// ─── Шаги ─────────────────────────────────────────────────────────────────

export type AddStepInput = {
  type: ProgramStepType
  title?: string
  refId?: string
  required: boolean
}

export async function addProgramStep(actor: CurrentUser, programId: string, input: AddStepInput) {
  const program = await findProgram(actor, programId)
  if (!program) return { ok: false as const, error: 'notFound' as const }

  let title = input.title?.trim() ?? ''
  let refId: string | null = null

  if (input.type === 'DOCUMENT') {
    if (!input.refId) return { ok: false as const, error: 'refRequired' as const }
    const document = await db.document.findFirst({
      where: { id: input.refId, locationId: actor.locationId, deletedAt: null, space: { not: 'HR' } },
      select: { id: true, title: true },
    })
    if (!document) return { ok: false as const, error: 'notFound' as const }
    refId = document.id
    title ||= document.title
  } else if (input.type === 'TEST') {
    if (!input.refId) return { ok: false as const, error: 'refRequired' as const }
    const test = await db.test.findFirst({
      where: { id: input.refId, locationId: actor.locationId, deletedAt: null },
      select: { id: true, title: true },
    })
    if (!test) return { ok: false as const, error: 'notFound' as const }
    refId = test.id
    title ||= test.title
  } else if (!title) {
    return { ok: false as const, error: 'titleRequired' as const }
  }

  const last = await db.programStep.findFirst({
    where: { programId: program.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const step = await db.programStep.create({
    data: {
      programId: program.id,
      type: input.type,
      title,
      refId,
      required: input.required,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'program.step.added',
    entityType: 'Program',
    entityId: program.id,
    locationId: actor.locationId,
    after: { stepId: step.id, type: input.type, title, required: input.required },
  })

  return { ok: true as const, stepId: step.id }
}

export async function removeProgramStep(actor: CurrentUser, stepId: string) {
  const step = await db.programStep.findFirst({
    where: { id: stepId, program: { locationId: actor.locationId } },
    select: { id: true, programId: true, title: true, type: true },
  })
  if (!step) return { ok: false as const, error: 'notFound' as const }

  // Отметки куратора удаляются вместе с шагом: у связи нет каскада,
  // и без этого база отказала бы в удалении
  await db.$transaction([
    db.programStepProgress.deleteMany({ where: { stepId: step.id } }),
    db.programStep.delete({ where: { id: step.id } }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: 'program.step.removed',
    entityType: 'Program',
    entityId: step.programId,
    locationId: actor.locationId,
    before: { stepId: step.id, type: step.type, title: step.title },
  })

  return { ok: true as const, programId: step.programId }
}

export async function moveProgramStep(actor: CurrentUser, stepId: string, direction: 'up' | 'down') {
  const step = await db.programStep.findFirst({
    where: { id: stepId, program: { locationId: actor.locationId } },
    select: { programId: true },
  })
  if (!step) return { ok: false as const, error: 'notFound' as const }

  const steps = await db.programStep.findMany({
    where: { programId: step.programId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })

  const index = steps.findIndex((candidate) => candidate.id === stepId)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= steps.length) {
    return { ok: true as const, programId: step.programId }
  }

  ;[steps[index], steps[target]] = [steps[target], steps[index]]

  // Порядок перенумеровывается целиком: у шагов sortOrder мог совпадать,
  // и обмен двух одинаковых значений ничего бы не поменял
  await db.$transaction(
    steps.map((candidate, position) =>
      db.programStep.update({ where: { id: candidate.id }, data: { sortOrder: (position + 1) * 10 } }),
    ),
  )

  return { ok: true as const, programId: step.programId }
}

// ─── Участники ────────────────────────────────────────────────────────────

export type EnrollInput = {
  programId: string
  userId: string
  mentorId?: string
  dueAt?: string
}

export async function enrollInProgram(actor: CurrentUser, input: EnrollInput) {
  const program = await findProgram(actor, input.programId)
  if (!program) return { ok: false as const, error: 'notFound' as const }
  if (!program.isActive) return { ok: false as const, error: 'programInactive' as const }

  const participant = await db.user.findFirst({
    where: {
      id: input.userId,
      locationId: actor.locationId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'INVITED'] },
    },
    select: { id: true, role: { select: { level: true } } },
  })
  if (!participant) return { ok: false as const, error: 'notFound' as const }

  // Записать на программу — то же, что поставить задачу: только вниз по иерархии
  if (!outranks(actor, participant.role.level)) {
    return { ok: false as const, error: 'participantTooHigh' as const }
  }

  if (input.mentorId) {
    if (input.mentorId === participant.id) {
      return { ok: false as const, error: 'mentorIsParticipant' as const }
    }
    const mentor = await db.user.findFirst({
      where: { id: input.mentorId, locationId: actor.locationId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!mentor) return { ok: false as const, error: 'notFound' as const }
  }

  // Обычный повтор ловим заранее: иначе Prisma писала бы в лог сервера ошибку
  // уникального индекса на каждое случайное двойное нажатие
  const existing = await db.programEnrollment.findUnique({
    where: { userId_programId: { userId: participant.id, programId: program.id } },
    select: { id: true },
  })
  if (existing) return { ok: false as const, error: 'alreadyEnrolled' as const }

  try {
    // Уникальный индекс остаётся страховкой от гонки двух одновременных записей
    const enrollment = await db.programEnrollment.create({
      data: {
        programId: program.id,
        userId: participant.id,
        mentorId: input.mentorId || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
      select: { id: true },
    })

    await writeAudit({
      actorId: actor.id,
      action: 'program.enrolled',
      entityType: 'ProgramEnrollment',
      entityId: enrollment.id,
      locationId: actor.locationId,
      after: { programId: program.id, userId: participant.id, mentorId: input.mentorId ?? null },
    })

    return { ok: true as const, enrollmentId: enrollment.id }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, error: 'alreadyEnrolled' as const }
    throw error
  }
}

export async function cancelEnrollment(actor: CurrentUser, enrollmentId: string) {
  const enrollment = await db.programEnrollment.findFirst({
    where: { id: enrollmentId, program: { locationId: actor.locationId } },
    select: { id: true, programId: true, userId: true, completedAt: true },
  })
  if (!enrollment) return { ok: false as const, error: 'notFound' as const }

  // Завершённое обучение — факт с выданным сертификатом, стирать его нельзя
  if (enrollment.completedAt) return { ok: false as const, error: 'enrollmentCompleted' as const }

  await db.programEnrollment.delete({ where: { id: enrollment.id } })

  await writeAudit({
    actorId: actor.id,
    action: 'program.enrollment.cancelled',
    entityType: 'ProgramEnrollment',
    entityId: enrollment.id,
    locationId: actor.locationId,
    before: { programId: enrollment.programId, userId: enrollment.userId },
  })

  return { ok: true as const, programId: enrollment.programId }
}

export async function getEnrollment(actor: CurrentUser, enrollmentId: string) {
  const enrollment = await db.programEnrollment.findFirst({
    where: { id: enrollmentId, program: { locationId: actor.locationId } },
    select: {
      id: true,
      userId: true,
      programId: true,
      mentorId: true,
      startedAt: true,
      completedAt: true,
      dueAt: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      mentor: { select: { id: true, firstName: true, lastName: true } },
      program: { select: { id: true, name: true, description: true, type: true, isActive: true } },
    },
  })
  if (!enrollment) return null

  const permissions = await getPermissions(actor.id)
  const isParticipant = enrollment.userId === actor.id
  const isMentor = enrollment.mentorId === actor.id
  if (!isParticipant && !isMentor && !permissions.has('program.view')) return null

  const stepsByProgram = await loadSteps([enrollment.programId])
  const steps = (await computeStepStates([enrollment], stepsByProgram)).get(enrollment.id) ?? []

  const certificate = enrollment.completedAt
    ? await db.certificate.findFirst({
        where: { userId: enrollment.userId, programId: enrollment.programId },
        orderBy: { issuedAt: 'desc' },
        select: { id: true, number: true, issuedAt: true },
      })
    : null

  const completed = Boolean(enrollment.completedAt)

  return {
    ...enrollment,
    steps,
    progress: summarizeProgress(steps),
    certificate,
    overdue: isOverdue(enrollment.dueAt, enrollment.completedAt, Date.now()),
    isParticipant,
    // Практику подтверждает куратор или человек с правом — но не сам участник
    canVerifyPractice:
      !completed && !isParticipant && (isMentor || permissions.has('program.step.verify')),
    canIssue: !completed && !isParticipant && permissions.has('certificate.issue'),
    canCancel: !completed && permissions.has('program.enroll'),
  }
}

/// Программы человека: для раздела «Мои программы» и для профиля сотрудника
export async function listUserEnrollments(actor: CurrentUser, userId: string) {
  if (userId !== actor.id) {
    const permissions = await getPermissions(actor.id)
    if (!permissions.has('program.view')) return []
  }

  const enrollments = await db.programEnrollment.findMany({
    where: { userId, program: { locationId: actor.locationId } },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      programId: true,
      startedAt: true,
      completedAt: true,
      dueAt: true,
      program: { select: { id: true, name: true, type: true } },
      mentor: { select: { firstName: true, lastName: true } },
    },
  })
  if (enrollments.length === 0) return []

  const stepsByProgram = await loadSteps(unique(enrollments.map((enrollment) => enrollment.programId)))
  const [states, certificates] = await Promise.all([
    computeStepStates(enrollments, stepsByProgram),
    db.certificate.findMany({
      where: { userId, program: { locationId: actor.locationId } },
      orderBy: { issuedAt: 'desc' },
      select: { id: true, number: true, issuedAt: true, programId: true },
    }),
  ])

  const certificateByProgram = new Map<string, (typeof certificates)[number]>()
  for (const certificate of certificates) {
    if (!certificateByProgram.has(certificate.programId)) {
      certificateByProgram.set(certificate.programId, certificate)
    }
  }

  const now = Date.now()
  return enrollments.map((enrollment) => ({
    ...enrollment,
    progress: summarizeProgress(states.get(enrollment.id) ?? []),
    certificate: certificateByProgram.get(enrollment.programId) ?? null,
    overdue: isOverdue(enrollment.dueAt, enrollment.completedAt, now),
  }))
}

// ─── Отметки по шагам ─────────────────────────────────────────────────────

export async function setPracticeStep(
  actor: CurrentUser,
  input: { enrollmentId: string; stepId: string; done: boolean; note?: string },
) {
  const enrollment = await db.programEnrollment.findFirst({
    where: { id: input.enrollmentId, program: { locationId: actor.locationId } },
    select: { id: true, userId: true, mentorId: true, completedAt: true, programId: true },
  })
  if (!enrollment) return { ok: false as const, error: 'notFound' as const }

  // После выдачи сертификата прогресс заморожен: он уже подписан
  if (enrollment.completedAt) return { ok: false as const, error: 'enrollmentCompleted' as const }

  // Свою практику участник не подтверждает, иначе отметка ничего бы не значила
  if (enrollment.userId === actor.id) return { ok: false as const, error: 'cannotVerifyOwn' as const }

  if (enrollment.mentorId !== actor.id) {
    const permissions = await getPermissions(actor.id)
    if (!permissions.has('program.step.verify')) return { ok: false as const, error: 'forbidden' as const }
  }

  const step = await db.programStep.findFirst({
    where: { id: input.stepId, programId: enrollment.programId },
    select: { id: true, type: true, title: true },
  })
  if (!step) return { ok: false as const, error: 'notFound' as const }
  if (step.type !== 'PRACTICE') return { ok: false as const, error: 'notPracticeStep' as const }

  const mark = input.done
    ? { completedAt: new Date(), completedById: actor.id, note: input.note || null }
    : { completedAt: null, completedById: null, note: null }

  await db.programStepProgress.upsert({
    where: { enrollmentId_stepId: { enrollmentId: enrollment.id, stepId: step.id } },
    update: mark,
    create: { enrollmentId: enrollment.id, stepId: step.id, ...mark },
  })

  await writeAudit({
    actorId: actor.id,
    action: input.done ? 'program.step.verified' : 'program.step.reverted',
    entityType: 'ProgramEnrollment',
    entityId: enrollment.id,
    locationId: actor.locationId,
    after: { stepId: step.id, title: step.title },
  })

  return { ok: true as const }
}

/// Подтверждение прочтения прямо со страницы программы. Документ может быть
/// не назначен участнику напрямую — назначением служит сам шаг программы
export async function acknowledgeStepDocument(actor: CurrentUser, enrollmentId: string, stepId: string) {
  const enrollment = await db.programEnrollment.findFirst({
    where: { id: enrollmentId, userId: actor.id, program: { locationId: actor.locationId } },
    select: { id: true, programId: true, completedAt: true },
  })
  if (!enrollment) return { ok: false as const, error: 'notFound' as const }
  if (enrollment.completedAt) return { ok: false as const, error: 'enrollmentCompleted' as const }

  const step = await db.programStep.findFirst({
    where: { id: stepId, programId: enrollment.programId, type: 'DOCUMENT' },
    select: { refId: true },
  })
  if (!step?.refId) return { ok: false as const, error: 'notFound' as const }

  const document = await db.document.findFirst({
    where: { id: step.refId, locationId: actor.locationId, deletedAt: null },
    select: { currentVersionId: true },
  })
  if (!document?.currentVersionId) return { ok: false as const, error: 'unavailable' as const }

  await acknowledgeDocument(actor, document.currentVersionId)
  return { ok: true as const }
}

// ─── Сертификаты ──────────────────────────────────────────────────────────

const MAX_NUMBER_ATTEMPTS = 5

class AlreadyCompletedError extends Error {}

/// Номер читаемый и последовательный: его диктуют по телефону, когда кафе,
/// откуда приехал гость MIT, проверяет сертификат. Гонку двух одновременных
/// выдач ловит уникальный индекс, а не этот подсчёт
async function nextCertificateNumber(prefix: string): Promise<string> {
  const last = await db.certificate.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const lastSequence = last ? Number.parseInt(last.number.slice(prefix.length), 10) || 0 : 0
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`
}

export async function completeEnrollment(actor: CurrentUser, enrollmentId: string) {
  const permissions = await getPermissions(actor.id)
  if (!permissions.has('certificate.issue')) return { ok: false as const, error: 'forbidden' as const }

  const enrollment = await db.programEnrollment.findFirst({
    where: { id: enrollmentId, program: { locationId: actor.locationId } },
    select: {
      id: true,
      userId: true,
      programId: true,
      completedAt: true,
      user: { select: { firstName: true, lastName: true, locale: true } },
      program: {
        select: { name: true, location: { select: { code: true, name: true, timezone: true } } },
      },
    },
  })
  if (!enrollment) return { ok: false as const, error: 'notFound' as const }
  if (enrollment.completedAt) return { ok: false as const, error: 'alreadyCompleted' as const }

  // Подпись под собственным сертификатом ничего не удостоверяет
  if (enrollment.userId === actor.id) return { ok: false as const, error: 'cannotIssueOwn' as const }

  const stepsByProgram = await loadSteps([enrollment.programId])
  const states = (await computeStepStates([enrollment], stepsByProgram)).get(enrollment.id) ?? []
  if (!summarizeProgress(states).ready) return { ok: false as const, error: 'notReady' as const }

  const issuedAt = new Date()
  const location = enrollment.program.location
  // Год берём по часовому поясу кафе: в новогоднюю ночь сервер в UTC
  // присвоил бы сертификату прошлый год
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: location.timezone }).format(issuedAt)
  const prefix = `${location.code}-${year}-`
  const certificateLocale = enrollment.user.locale === 'en' ? 'en' : 'pl'

  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    const number = await nextCertificateNumber(prefix)

    const pdf = await renderCertificatePdf({
      locale: certificateLocale,
      recipientName: `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim(),
      programName: enrollment.program.name,
      locationName: location.name,
      number,
      issuedAt,
      issuerName: actor.fullName,
      issuerRole: certificateLocale === 'en' ? actor.role.nameEn : actor.role.namePl,
      timeZone: location.timezone,
    })

    // В ключе случайная часть: при гонке за один номер второй файл
    // не перезапишет первый до того, как база отклонит дубликат
    const fileKey = buildKey(`certificates/${actor.locationId}`, `${number}.pdf`)
    await uploadFile({ key: fileKey, body: pdf, contentType: 'application/pdf' })

    try {
      const certificate = await db.$transaction(async (tx) => {
        // Условие completedAt: null защищает от двойной выдачи, если два
        // менеджера нажали кнопку одновременно
        const updated = await tx.programEnrollment.updateMany({
          where: { id: enrollment.id, completedAt: null },
          data: { completedAt: issuedAt },
        })
        if (updated.count === 0) throw new AlreadyCompletedError()

        return tx.certificate.create({
          data: {
            userId: enrollment.userId,
            programId: enrollment.programId,
            number,
            issuedAt,
            fileKey,
            issuedById: actor.id,
          },
          select: { id: true, number: true },
        })
      })

      await writeAudit({
        actorId: actor.id,
        action: 'certificate.issued',
        entityType: 'Certificate',
        entityId: certificate.id,
        locationId: actor.locationId,
        after: { number, programId: enrollment.programId, userId: enrollment.userId },
      })

      return { ok: true as const, certificateId: certificate.id, number: certificate.number }
    } catch (error) {
      await deleteFile(fileKey).catch(() => undefined)
      if (error instanceof AlreadyCompletedError) {
        return { ok: false as const, error: 'alreadyCompleted' as const }
      }
      // Номер заняли параллельно — берём следующий
      if (isUniqueViolation(error)) continue
      throw error
    }
  }

  return { ok: false as const, error: 'numberConflict' as const }
}

/// Реестр выданных сертификатов. Поиск по номеру и есть проверка подлинности
export async function listCertificates(actor: CurrentUser, search?: string) {
  const term = search?.trim()
  return db.certificate.findMany({
    where: {
      program: { locationId: actor.locationId },
      ...(term
        ? {
            OR: [
              { number: { contains: term, mode: 'insensitive' as const } },
              { user: { lastName: { contains: term, mode: 'insensitive' as const } } },
              { user: { firstName: { contains: term, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    orderBy: { issuedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      number: true,
      issuedAt: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      program: { select: { id: true, name: true, type: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  })
}

/// Файл отдаётся владельцу и тем, кто видит программы или реестр.
/// Как и документы — через временную ссылку, а не прямым адресом в хранилище
export async function getCertificateDownload(actor: CurrentUser, certificateId: string) {
  const certificate = await db.certificate.findFirst({
    where: { id: certificateId, program: { locationId: actor.locationId } },
    select: { id: true, number: true, userId: true, fileKey: true },
  })
  if (!certificate?.fileKey) return null

  if (certificate.userId !== actor.id) {
    const permissions = await getPermissions(actor.id)
    if (!permissions.has('certificate.view') && !permissions.has('program.view')) return null
  }

  await writeAudit({
    actorId: actor.id,
    action: 'certificate.downloaded',
    entityType: 'Certificate',
    entityId: certificate.id,
    locationId: actor.locationId,
  })

  return { url: await getDownloadUrl(certificate.fileKey, `${certificate.number}.pdf`) }
}
