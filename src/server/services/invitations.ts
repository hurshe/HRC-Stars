import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { resolveLocale } from '@/i18n/config'
import { sendInvitationEmail } from './mailer'
import { writeAudit } from './audit'

/// Алфавит кода активации без символов, которые путают на слух и на вид:
/// нет 0/O, 1/I/L, 5/S, 8/B. Код диктуют голосом, поэтому это важно.
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY234679'
const CODE_LENGTH = 10

const DEFAULT_LINK_TTL_DAYS = 7
const DEFAULT_CODE_TTL_HOURS = 24

/// Токен приглашения хранится только хешем: утечка базы не даёт возможности
/// активировать чужие учётки. Энтропии 256 бит достаточно, растягивание
/// вроде bcrypt тут не нужно — перебор невозможен по объёму пространства.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return code
}

async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const setting = await db.setting.findUnique({ where: { scope_key: { scope: 'GLOBAL', key } } })
  return typeof setting?.value === 'number' ? setting.value : fallback
}

/// Все прежние действующие приглашения отзываются: у сотрудника всегда
/// не больше одного рабочего способа активации.
async function revokePendingInvitations(userId: string) {
  await db.invitation.updateMany({
    where: { userId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export type InvitationLink = { url: string; expiresAt: Date; emailSent: boolean }

/// Приглашение по ссылке: письмо со ссылкой, сотрудник сам задаёт пароль.
export async function createInvitationLink(params: {
  userId: string
  createdById: string
}): Promise<InvitationLink> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: params.userId },
    select: { id: true, email: true, firstName: true, lastName: true, locale: true, locationId: true },
  })

  await revokePendingInvitations(user.id)

  const ttlDays = await getSettingNumber('invitation.link_ttl_days', DEFAULT_LINK_TTL_DAYS)
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  await db.invitation.create({
    data: {
      userId: user.id,
      type: 'EMAIL_LINK',
      tokenHash: hashToken(token),
      expiresAt,
      createdById: params.createdById,
    },
  })

  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const url = `${baseUrl}/activate?token=${token}`

  const mail = await sendInvitationEmail({
    to: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    url,
    expiresAt,
    locale: resolveLocale(user.locale),
  })

  await writeAudit({
    actorId: params.createdById,
    action: 'invitation.link.created',
    entityType: 'User',
    entityId: user.id,
    locationId: user.locationId,
    after: { type: 'EMAIL_LINK', expiresAt: expiresAt.toISOString(), emailSent: mail.ok },
  })

  // Ссылку возвращаем в любом случае: если почта не ушла, менеджер
  // скопирует её вручную, а не будет ждать починки SMTP.
  return { url, expiresAt, emailSent: mail.ok }
}

export type ActivationCode = { code: string; expiresAt: Date }

/// Код активации: менеджер показывает его на экране и диктует лично.
/// Нужен, когда у сотрудника нет доступа к почте прямо сейчас.
export async function createActivationCode(params: {
  userId: string
  createdById: string
}): Promise<ActivationCode> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: params.userId },
    select: { id: true, locationId: true },
  })

  await revokePendingInvitations(user.id)

  const ttlHours = await getSettingNumber('invitation.code_ttl_hours', DEFAULT_CODE_TTL_HOURS)
  const code = generateCode()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  await db.invitation.create({
    data: {
      userId: user.id,
      type: 'ACTIVATION_CODE',
      tokenHash: hashToken(code),
      expiresAt,
      createdById: params.createdById,
    },
  })

  await writeAudit({
    actorId: params.createdById,
    action: 'invitation.code.created',
    entityType: 'User',
    entityId: user.id,
    locationId: user.locationId,
    after: { type: 'ACTIVATION_CODE', expiresAt: expiresAt.toISOString() },
  })

  return { code, expiresAt }
}

export type InvitationFailure = 'invitationInvalid' | 'invitationExpired' | 'invitationUsed'

export type InvitationCheck =
  | { ok: true; invitationId: string; userId: string; email: string; name: string }
  | { ok: false; error: InvitationFailure }

async function checkInvitationRecord(tokenHash: string): Promise<InvitationCheck> {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usedAt: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, status: true, deletedAt: true },
      },
    },
  })

  if (!invitation || invitation.user.deletedAt) return { ok: false, error: 'invitationInvalid' }
  if (invitation.usedAt) return { ok: false, error: 'invitationUsed' }
  if (invitation.revokedAt) return { ok: false, error: 'invitationInvalid' }
  if (invitation.expiresAt < new Date()) return { ok: false, error: 'invitationExpired' }

  return {
    ok: true,
    invitationId: invitation.id,
    userId: invitation.user.id,
    email: invitation.user.email,
    name: `${invitation.user.firstName} ${invitation.user.lastName}`.trim(),
  }
}

export function checkInvitationToken(token: string): Promise<InvitationCheck> {
  return checkInvitationRecord(hashToken(token))
}

/// Код активации проверяется в паре с адресом почты: перебор становится
/// привязан к конкретной учётке, а не идёт по всей базе разом.
export async function checkActivationCode(email: string, code: string): Promise<InvitationCheck> {
  const normalizedCode = code.trim().toUpperCase().replace(/[\s-]/g, '')
  const result = await checkInvitationRecord(hashToken(normalizedCode))
  if (!result.ok) return result

  const expected = Buffer.from(result.email.toLowerCase())
  const actual = Buffer.from(email.toLowerCase().trim())
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual)

  return matches ? result : { ok: false, error: 'invitationInvalid' }
}

/// Завершение активации: пароль задан, учётка становится активной,
/// приглашение гасится и повторно использовано быть не может.
export async function completeActivation(params: {
  invitationId: string
  userId: string
  password: string
}): Promise<void> {
  const passwordHash = await hash(params.password, 12)

  await db.$transaction([
    db.user.update({
      where: { id: params.userId },
      data: {
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false,
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    db.invitation.update({
      where: { id: params.invitationId },
      data: { usedAt: new Date() },
    }),
  ])

  await writeAudit({
    actorId: params.userId,
    action: 'invitation.completed',
    entityType: 'User',
    entityId: params.userId,
    after: { status: 'ACTIVE' },
  })
}
