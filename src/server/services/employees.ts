import type { Prisma, UserStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { decryptOptional, encryptOptional } from '@/lib/crypto'
import type {
  CreateEmployeeInput,
  EmployeeFilters,
  InviteMethod,
  UpdateEmployeeInput,
} from '@/lib/employee-schema'
import { getPermissions, outranks, type CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'
import { createActivationCode, createInvitationLink } from './invitations'

export const PAGE_SIZE = 25

export type EmployeeListItem = {
  id: string
  fullName: string
  email: string
  employeeNumber: string | null
  status: UserStatus
  isTrainer: boolean
  roleCode: string
  roleLevel: number
  positions: { code: string; nameEn: string; namePl: string }[]
}

/// Список сотрудников своей локации. Персональные данные сюда не попадают
/// вообще — ни зашифрованными, ни расшифрованными: списку они не нужны,
/// а лишний доступ к ним пришлось бы логировать на каждый показ страницы.
export async function listEmployees(
  actor: CurrentUser,
  filters: EmployeeFilters,
): Promise<{ items: EmployeeListItem[]; total: number; page: number; pageCount: number }> {
  const where: Prisma.UserWhereInput = {
    locationId: actor.locationId,
    deletedAt: null,
  }

  // Kitchen Manager видит только свой департамент
  if (actor.departmentScopeId) {
    where.positions = {
      some: { position: { departmentId: actor.departmentScopeId }, endedAt: null },
    }
  }

  if (filters.status) where.status = filters.status
  if (filters.positionId) {
    where.positions = { some: { positionId: filters.positionId, endedAt: null } }
  }

  if (filters.search) {
    const search = filters.search
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeNumber: true,
        status: true,
        isTrainer: true,
        role: { select: { code: true, level: true } },
        positions: {
          where: { endedAt: null },
          orderBy: { isPrimary: 'desc' },
          select: { position: { select: { code: true, nameEn: true, namePl: true } } },
        },
      },
    }),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
      employeeNumber: row.employeeNumber,
      status: row.status,
      isTrainer: row.isTrainer,
      roleCode: row.role.code,
      roleLevel: row.role.level,
      positions: row.positions.map((p) => p.position),
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployee>>>

export async function getEmployee(actor: CurrentUser, id: string) {
  const user = await db.user.findFirst({
    where: { id, locationId: actor.locationId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeNumber: true,
      status: true,
      isTrainer: true,
      locale: true,
      hiredAt: true,
      guestUntil: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, code: true, level: true, nameEn: true, namePl: true } },
      location: { select: { name: true } },
      positions: {
        where: { endedAt: null },
        orderBy: { isPrimary: 'desc' },
        select: {
          isPrimary: true,
          startedAt: true,
          position: { select: { id: true, code: true, nameEn: true, namePl: true } },
        },
      },
      invitations: {
        where: { usedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, type: true, expiresAt: true, createdAt: true },
      },
    },
  })

  return user
}

export type PersonalData = {
  phone: string | null
  dateOfBirth: string | null
  address: string | null
  personalId: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  gender: string | null
  employmentType: string | null
  notes: string | null
}

/// Персональные данные читаются отдельным вызовом, а не вместе с карточкой.
/// Так каждый факт просмотра попадает в аудит именно тогда, когда данные
/// действительно показали, а не когда просто открыли профиль.
export async function readPersonalData(
  actor: CurrentUser,
  userId: string,
): Promise<PersonalData | null> {
  const permissions = await getPermissions(actor.id)
  if (!permissions.has('personal_data.view')) return null

  const profile = await db.employeeProfile.findUnique({ where: { userId } })
  if (!profile) return null

  await writeAudit({
    actorId: actor.id,
    action: 'personal_data.viewed',
    entityType: 'EmployeeProfile',
    entityId: profile.id,
    locationId: actor.locationId,
    isSensitive: true,
    after: { subjectUserId: userId },
  })

  return {
    phone: decryptOptional(profile.phoneEnc),
    dateOfBirth: decryptOptional(profile.dateOfBirthEnc),
    address: decryptOptional(profile.addressEnc),
    personalId: decryptOptional(profile.personalIdEnc),
    emergencyContactName: decryptOptional(profile.emergencyContactNameEnc),
    emergencyContactPhone: decryptOptional(profile.emergencyContactPhoneEnc),
    gender: profile.gender,
    employmentType: profile.employmentType,
    notes: decryptOptional(profile.notesEnc),
  }
}

export type CreateEmployeeResult =
  | { ok: true; userId: string; invitationUrl?: string; activationCode?: string; emailSent?: boolean }
  | { ok: false; error: 'emailTaken' | 'employeeNumberTaken' | 'roleTooHigh' | 'invalidRole' }

/// Табельный номер: если менеджер не задал его вручную, собираем из кода
/// локации и порядкового номера. Совпадения возможны при одновременном
/// создании, поэтому на уникальный индекс есть повторная попытка.
async function generateEmployeeNumber(locationId: string): Promise<string> {
  const location = await db.location.findUniqueOrThrow({
    where: { id: locationId },
    select: { code: true },
  })
  const count = await db.user.count({ where: { locationId } })
  return `${location.code}-${1000 + count + 1}`
}

export async function createEmployee(
  actor: CurrentUser,
  input: CreateEmployeeInput,
): Promise<CreateEmployeeResult> {
  const role = await db.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, level: true, code: true },
  })
  if (!role) return { ok: false, error: 'invalidRole' }

  // Нельзя завести человека с ролью выше или равной своей: иначе менеджер
  // мог бы создать себе «сообщника» с правами директора
  if (!outranks(actor, role.level)) return { ok: false, error: 'roleTooHigh' }

  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing) return { ok: false, error: 'emailTaken' }

  if (input.employeeNumber) {
    const taken = await db.user.findUnique({ where: { employeeNumber: input.employeeNumber } })
    if (taken) return { ok: false, error: 'employeeNumberTaken' }
  }

  const employeeNumber = input.employeeNumber ?? (await generateEmployeeNumber(actor.locationId))
  const primaryPositionId = input.primaryPositionId ?? input.positionIds[0]

  const user = await db.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      employeeNumber,
      locale: input.locale,
      status: 'INVITED',
      roleId: role.id,
      locationId: actor.locationId,
      hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
      positions: {
        create: input.positionIds.map((positionId) => ({
          positionId,
          isPrimary: positionId === primaryPositionId,
        })),
      },
      profile: {
        create: {
          phoneEnc: encryptOptional(input.phone),
          dateOfBirthEnc: encryptOptional(input.dateOfBirth),
          addressEnc: encryptOptional(input.address),
          personalIdEnc: encryptOptional(input.personalId),
          emergencyContactNameEnc: encryptOptional(input.emergencyContactName),
          emergencyContactPhoneEnc: encryptOptional(input.emergencyContactPhone),
          notesEnc: encryptOptional(input.notes),
          gender: input.gender,
          employmentType: input.employmentType,
        },
      },
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'employee.created',
    entityType: 'User',
    entityId: user.id,
    locationId: actor.locationId,
    after: {
      email: input.email,
      role: role.code,
      employeeNumber,
      positions: input.positionIds.length,
    },
  })

  return { ok: true, userId: user.id, ...(await issueInvite(actor.id, user.id, input.inviteMethod)) }
}

async function issueInvite(actorId: string, userId: string, method: InviteMethod) {
  if (method === 'EMAIL_LINK') {
    const invitation = await createInvitationLink({ userId, createdById: actorId })
    return { invitationUrl: invitation.url, emailSent: invitation.emailSent }
  }
  if (method === 'ACTIVATION_CODE') {
    const invitation = await createActivationCode({ userId, createdById: actorId })
    return { activationCode: invitation.code }
  }
  return {}
}

export type UpdateEmployeeResult =
  | { ok: true }
  | {
      ok: false
      error: 'notFound' | 'roleTooHigh' | 'employeeNumberTaken' | 'invalidRole' | 'cannotEditPeer'
    }

/// Обновление карточки. Персональные данные пишутся только при наличии
/// отдельного права: менеджер без него может поправить позицию и статус,
/// но не тронет адрес и номер документа.
export async function updateEmployee(
  actor: CurrentUser,
  input: UpdateEmployeeInput,
): Promise<UpdateEmployeeResult> {
  const target = await db.user.findFirst({
    where: { id: input.userId, locationId: actor.locationId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      status: true,
      hiredAt: true,
      roleId: true,
      role: { select: { level: true, code: true } },
      positions: { where: { endedAt: null }, select: { positionId: true, isPrimary: true } },
    },
  })
  if (!target) return { ok: false, error: 'notFound' }

  // Редактировать можно только тех, кто ниже по иерархии. Себя — тоже нет:
  // иначе можно поднять себе роль, что и есть основной сценарий злоупотребления
  if (!outranks(actor, target.role.level)) return { ok: false, error: 'cannotEditPeer' }

  const role = await db.role.findUnique({
    where: { id: input.roleId },
    select: { id: true, level: true, code: true },
  })
  if (!role) return { ok: false, error: 'invalidRole' }
  if (!outranks(actor, role.level)) return { ok: false, error: 'roleTooHigh' }

  if (input.employeeNumber && input.employeeNumber !== target.employeeNumber) {
    const taken = await db.user.findUnique({ where: { employeeNumber: input.employeeNumber } })
    if (taken) return { ok: false, error: 'employeeNumberTaken' }
  }

  const permissions = await getPermissions(actor.id)
  const canEditPersonal = permissions.has('personal_data.edit')

  const primaryPositionId = input.primaryPositionId ?? input.positionIds[0]
  const currentPositionIds = target.positions.map((p) => p.positionId)
  const removed = currentPositionIds.filter((id) => !input.positionIds.includes(id))
  const added = input.positionIds.filter((id) => !currentPositionIds.includes(id))

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        employeeNumber: input.employeeNumber ?? target.employeeNumber,
        locale: input.locale,
        status: input.status,
        roleId: role.id,
        hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
      },
    })

    // Снятую позицию не удаляем, а закрываем датой: история того, кем человек
    // работал, нужна для отчётов и для уже пройденных им тестов
    if (removed.length > 0) {
      await tx.employeePosition.updateMany({
        where: { userId: target.id, positionId: { in: removed }, endedAt: null },
        data: { endedAt: new Date() },
      })
    }

    for (const positionId of added) {
      await tx.employeePosition.upsert({
        where: { userId_positionId: { userId: target.id, positionId } },
        update: { endedAt: null, isPrimary: positionId === primaryPositionId },
        create: { userId: target.id, positionId, isPrimary: positionId === primaryPositionId },
      })
    }

    await tx.employeePosition.updateMany({
      where: { userId: target.id, endedAt: null },
      data: { isPrimary: false },
    })
    await tx.employeePosition.updateMany({
      where: { userId: target.id, positionId: primaryPositionId, endedAt: null },
      data: { isPrimary: true },
    })

    if (canEditPersonal) {
      const personal = {
        phoneEnc: encryptOptional(input.phone),
        dateOfBirthEnc: encryptOptional(input.dateOfBirth),
        addressEnc: encryptOptional(input.address),
        personalIdEnc: encryptOptional(input.personalId),
        emergencyContactNameEnc: encryptOptional(input.emergencyContactName),
        emergencyContactPhoneEnc: encryptOptional(input.emergencyContactPhone),
        notesEnc: encryptOptional(input.notes),
        gender: input.gender ?? null,
        employmentType: input.employmentType ?? null,
      }
      await tx.employeeProfile.upsert({
        where: { userId: target.id },
        update: personal,
        create: { userId: target.id, ...personal },
      })
    }
  })

  // В аудит попадают только несекретные поля: сам журнал не должен становиться
  // копией персональных данных в открытом виде
  await writeAudit({
    actorId: actor.id,
    action: 'employee.updated',
    entityType: 'User',
    entityId: target.id,
    locationId: actor.locationId,
    before: {
      firstName: target.firstName,
      lastName: target.lastName,
      status: target.status,
      role: target.role.code,
      employeeNumber: target.employeeNumber,
      positions: currentPositionIds.length,
    },
    after: {
      firstName: input.firstName,
      lastName: input.lastName,
      status: input.status,
      role: role.code,
      employeeNumber: input.employeeNumber ?? target.employeeNumber,
      positions: input.positionIds.length,
      personalDataTouched: canEditPersonal,
    },
  })

  return { ok: true }
}

/// Повторная отправка приглашения из карточки сотрудника
export async function resendInvitation(
  actor: CurrentUser,
  userId: string,
  method: Exclude<InviteMethod, 'NONE'>,
) {
  const target = await db.user.findFirst({
    where: { id: userId, locationId: actor.locationId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!target) return { ok: false as const, error: 'notFound' as const }
  if (target.status !== 'INVITED') return { ok: false as const, error: 'alreadyActive' as const }

  return { ok: true as const, ...(await issueInvite(actor.id, target.id, method)) }
}

/// Ярлык тренера: отдельная операция и отдельное право, потому что это
/// не изменение анкеты, а выдача возможности создавать тесты и материалы
export async function setTrainerFlag(actor: CurrentUser, userId: string, isTrainer: boolean) {
  const target = await db.user.findFirst({
    where: { id: userId, locationId: actor.locationId, deletedAt: null },
    select: { id: true, isTrainer: true },
  })
  if (!target) return { ok: false as const }

  await db.user.update({ where: { id: target.id }, data: { isTrainer } })
  await writeAudit({
    actorId: actor.id,
    action: 'employee.trainer.changed',
    entityType: 'User',
    entityId: target.id,
    locationId: actor.locationId,
    before: { isTrainer: target.isTrainer },
    after: { isTrainer },
  })

  return { ok: true as const }
}
