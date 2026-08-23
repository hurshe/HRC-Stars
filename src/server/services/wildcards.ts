import { db } from '@/lib/db'
import { outranks, type CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'
import { getSetting, getSettingNumber } from './settings'

/*
  Wild Cards.

  Срок годности начинает идти ТОЛЬКО с момента выдачи сотруднику.
  Пока карты лежат на счету менеджера, они бессрочны — это пачка в ящике
  стола, а не начисление. Поэтому счёт менеджера (WildCardStock) — просто
  число без дат, а выдача сотруднику создаёт партию с датой сгорания.

  Карты у сотрудника хранятся партиями, а не одним счётчиком. Причина:
  у каждой партии свой срок годности, и списывать нужно самые старые
  первыми — иначе на ваучер уйдут свежие карты, старые сгорят, и человек
  потеряет заработанное на ровном месте.

  Резерв не хранится отдельным полем: он вычисляется как сумма заявок
  в статусе PENDING. Так невозможно рассинхронизировать баланс и резерв.
*/

export const DEFAULT_TTL_DAYS = 90

export type Balance = {
  available: number
  reserved: number
  total: number
  /// Сколько карт сгорит в ближайшие две недели
  expiringSoon: number
  expiringAt: Date | null
}

export async function getBalance(userId: string): Promise<Balance> {
  const now = new Date()
  const warningDays = await getSettingNumber('wildcard.expiry_warning_days', 14)
  const warningDate = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000)

  const [grants, pending] = await Promise.all([
    db.wildCardGrant.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      select: { amount: true, consumed: true, expiresAt: true },
    }),
    db.voucherRequest.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { cost: true },
    }),
  ])

  const total = grants.reduce((sum, grant) => sum + (grant.amount - grant.consumed), 0)
  const reserved = pending._sum.cost ?? 0

  const expiring = grants.filter((grant) => grant.expiresAt <= warningDate)
  const expiringSoon = expiring.reduce((sum, grant) => sum + (grant.amount - grant.consumed), 0)

  return {
    total,
    reserved,
    available: Math.max(0, total - reserved),
    expiringSoon,
    expiringAt: expiring[0]?.expiresAt ?? null,
  }
}

/// Счёт менеджера. Дат здесь нет вообще: карты на счету не сгорают
export async function getManagerStock(userId: string) {
  const stock = await db.wildCardStock.findUnique({
    where: { userId },
    select: { id: true, balance: true, updatedAt: true },
  })
  return stock
}

/// Пополнение счёта менеджера. Право отдельное от выдачи сотрудникам:
/// раздавать карты может менеджер, а вот пополнять его запас — только GM и AGM
export async function allocateToManager(
  actor: CurrentUser,
  input: { managerId: string; amount: number; note?: string },
) {
  if (input.amount < 1) return { ok: false as const, error: 'invalidAmount' as const }

  const manager = await db.user.findFirst({
    where: { id: input.managerId, locationId: actor.locationId, deletedAt: null },
    select: { id: true, role: { select: { level: true } } },
  })
  if (!manager) return { ok: false as const, error: 'notFound' as const }
  if (!outranks(actor, manager.role.level)) {
    return { ok: false as const, error: 'managerTooHigh' as const }
  }

  const stock = await db.wildCardStock.upsert({
    where: { userId: manager.id },
    update: { balance: { increment: input.amount } },
    create: { userId: manager.id, balance: input.amount },
    select: { id: true, balance: true },
  })

  await db.wildCardAllocation.create({
    data: {
      stockId: stock.id,
      allocatedById: actor.id,
      amount: input.amount,
      note: input.note || null,
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'wildcard.allocated',
    entityType: 'WildCardStock',
    entityId: stock.id,
    locationId: actor.locationId,
    after: { managerId: manager.id, amount: input.amount, balance: stock.balance },
  })

  return { ok: true as const, balance: stock.balance }
}

export async function grantWildCards(
  actor: CurrentUser,
  input: { userId: string; amount: number; reason: string; note?: string },
) {
  const target = await db.user.findFirst({
    where: { id: input.userId, locationId: actor.locationId, deletedAt: null },
    select: { id: true },
  })
  if (!target) return { ok: false as const, error: 'notFound' as const }
  if (input.amount < 1) return { ok: false as const, error: 'invalidAmount' as const }

  // Необязательный предохранитель от обесценивания механики
  const monthlyLimit = await getSettingNumber('wildcard.monthly_grant_limit', 0)
  if (monthlyLimit > 0) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const issued = await db.wildCardGrant.aggregate({
      where: { grantedById: actor.id, grantedAt: { gte: monthStart } },
      _sum: { amount: true },
    })
    if ((issued._sum.amount ?? 0) + input.amount > monthlyLimit) {
      return { ok: false as const, error: 'monthlyLimitReached' as const }
    }
  }

  // Счёт менеджера заводится в тот момент, когда GM впервые выдаёт ему
  // пачку карт. Пока счёта нет, менеджер выдаёт без ограничения по запасу —
  // если нужен строгий учёт, включается настройкой
  const stock = await db.wildCardStock.findUnique({
    where: { userId: actor.id },
    select: { id: true, balance: true },
  })
  const strict = (await getSetting<boolean>('wildcard.require_manager_stock')) === true

  if (!stock && strict) return { ok: false as const, error: 'noStock' as const }
  if (stock && stock.balance < input.amount) {
    return { ok: false as const, error: 'notEnoughStock' as const }
  }

  const ttlDays = await getSettingNumber('wildcard.ttl_days', DEFAULT_TTL_DAYS)
  // Дата сгорания появляется именно здесь: до этого карты лежали
  // на счету менеджера без срока
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const grant = await db.$transaction(async (tx) => {
    if (stock) {
      await tx.wildCardStock.update({
        where: { id: stock.id },
        data: { balance: { decrement: input.amount } },
      })
    }

    return tx.wildCardGrant.create({
      data: {
        userId: input.userId,
        grantedById: actor.id,
        amount: input.amount,
        reason: input.reason,
        note: input.note || null,
        expiresAt,
      },
      select: { id: true },
    })
  })

  // Механика по сути денежная, поэтому каждая выдача в аудите
  await writeAudit({
    actorId: actor.id,
    action: 'wildcard.granted',
    entityType: 'WildCardGrant',
    entityId: grant.id,
    locationId: actor.locationId,
    after: { userId: input.userId, amount: input.amount, reason: input.reason },
  })

  return { ok: true as const, grantId: grant.id, expiresAt }
}

export async function listVoucherTypes(actor: CurrentUser) {
  return db.voucherType.findMany({
    where: { locationId: actor.locationId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      cost: true,
      validityDays: true,
      perPersonLimit: true,
    },
  })
}

export async function requestVoucher(actor: CurrentUser, voucherTypeId: string) {
  const voucher = await db.voucherType.findFirst({
    where: { id: voucherTypeId, locationId: actor.locationId, isActive: true },
    select: { id: true, cost: true, perPersonLimit: true, name: true },
  })
  if (!voucher) return { ok: false as const, error: 'notFound' as const }

  const balance = await getBalance(actor.id)
  // Проверяем именно доступный баланс, а не общий: две заявки подряд
  // не должны потратить одни и те же карты дважды
  if (balance.available < voucher.cost) {
    return { ok: false as const, error: 'insufficientBalance' as const }
  }

  if (voucher.perPersonLimit) {
    const used = await db.voucherRequest.count({
      where: { userId: actor.id, voucherTypeId, status: { in: ['APPROVED', 'USED'] } },
    })
    if (used >= voucher.perPersonLimit) {
      return { ok: false as const, error: 'limitReached' as const }
    }
  }

  const request = await db.voucherRequest.create({
    data: { userId: actor.id, voucherTypeId, cost: voucher.cost },
    select: { id: true },
  })

  return { ok: true as const, requestId: request.id }
}

/// Подтверждение списывает карты по принципу «самые старые первыми».
/// Партии, действовавшие на момент подачи заявки, засчитываются, даже если
/// успели истечь: задержка менеджера не должна съедать баланс сотрудника.
export async function approveVoucherRequest(actor: CurrentUser, requestId: string) {
  const request = await db.voucherRequest.findFirst({
    where: { id: requestId, status: 'PENDING', user: { locationId: actor.locationId } },
    select: {
      id: true,
      userId: true,
      cost: true,
      requestedAt: true,
      voucherType: { select: { name: true, validityDays: true } },
    },
  })
  if (!request) return { ok: false as const, error: 'notFound' as const }

  const grants = await db.wildCardGrant.findMany({
    where: { userId: request.userId, expiresAt: { gt: request.requestedAt } },
    orderBy: { expiresAt: 'asc' },
    select: { id: true, amount: true, consumed: true },
  })

  const availableNow = grants.reduce((sum, grant) => sum + (grant.amount - grant.consumed), 0)
  if (availableNow < request.cost) {
    return { ok: false as const, error: 'insufficientBalance' as const }
  }

  let remaining = request.cost
  const updates: { id: string; consumed: number }[] = []
  for (const grant of grants) {
    if (remaining <= 0) break
    const free = grant.amount - grant.consumed
    if (free <= 0) continue
    const take = Math.min(free, remaining)
    updates.push({ id: grant.id, consumed: grant.consumed + take })
    remaining -= take
  }

  const validUntil = request.voucherType.validityDays
    ? new Date(Date.now() + request.voucherType.validityDays * 24 * 60 * 60 * 1000)
    : null

  await db.$transaction([
    ...updates.map((update) =>
      db.wildCardGrant.update({ where: { id: update.id }, data: { consumed: update.consumed } }),
    ),
    db.voucherRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        decidedAt: new Date(),
        decidedById: actor.id,
        validUntil,
      },
    }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: 'voucher.approved',
    entityType: 'VoucherRequest',
    entityId: request.id,
    locationId: actor.locationId,
    after: { userId: request.userId, cost: request.cost, voucher: request.voucherType.name },
  })

  return { ok: true as const }
}

/// Отклонение ничего не возвращает вручную: резерв вычисляется из заявок
/// в статусе PENDING, поэтому смена статуса сама освобождает карты
export async function rejectVoucherRequest(actor: CurrentUser, requestId: string, note?: string) {
  const request = await db.voucherRequest.findFirst({
    where: { id: requestId, status: 'PENDING', user: { locationId: actor.locationId } },
    select: { id: true, userId: true, cost: true },
  })
  if (!request) return { ok: false as const, error: 'notFound' as const }

  await db.voucherRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      decidedAt: new Date(),
      decidedById: actor.id,
      rejectionNote: note || null,
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'voucher.rejected',
    entityType: 'VoucherRequest',
    entityId: request.id,
    locationId: actor.locationId,
    after: { userId: request.userId, cost: request.cost },
  })

  return { ok: true as const }
}

export async function markVoucherUsed(actor: CurrentUser, requestId: string) {
  const request = await db.voucherRequest.findFirst({
    where: { id: requestId, status: 'APPROVED', user: { locationId: actor.locationId } },
    select: { id: true },
  })
  if (!request) return { ok: false as const, error: 'notFound' as const }

  await db.voucherRequest.update({
    where: { id: request.id },
    data: { status: 'USED', usedAt: new Date(), markedUsedById: actor.id },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'voucher.used',
    entityType: 'VoucherRequest',
    entityId: request.id,
    locationId: actor.locationId,
  })

  return { ok: true as const }
}

export async function listMyWildCards(actor: CurrentUser) {
  const [grants, requests] = await Promise.all([
    db.wildCardGrant.findMany({
      where: { userId: actor.id },
      orderBy: { grantedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        consumed: true,
        reason: true,
        grantedAt: true,
        expiresAt: true,
        grantedBy: { select: { firstName: true, lastName: true } },
      },
    }),
    db.voucherRequest.findMany({
      where: { userId: actor.id },
      orderBy: { requestedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        cost: true,
        status: true,
        requestedAt: true,
        validUntil: true,
        voucherType: { select: { name: true } },
      },
    }),
  ])

  return { grants, requests }
}

/// Очередь заявок для менеджера
export async function listPendingRequests(actor: CurrentUser) {
  return db.voucherRequest.findMany({
    where: { status: 'PENDING', user: { locationId: actor.locationId } },
    orderBy: { requestedAt: 'asc' },
    select: {
      id: true,
      cost: true,
      requestedAt: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      voucherType: { select: { name: true } },
    },
  })
}

/// Отчёт «кто сколько выдал» — тем важнее, что выдающих в системе много
export async function grantReport(actor: CurrentUser, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const grants = await db.wildCardGrant.groupBy({
    by: ['grantedById'],
    where: { grantedAt: { gte: since }, user: { locationId: actor.locationId } },
    _sum: { amount: true },
    _count: { _all: true },
  })

  const granters = await db.user.findMany({
    where: { id: { in: grants.map((grant) => grant.grantedById) } },
    select: { id: true, firstName: true, lastName: true, role: { select: { code: true } } },
  })
  const byId = new Map(granters.map((granter) => [granter.id, granter]))

  return grants
    .map((grant) => ({
      granter: byId.get(grant.grantedById),
      cards: grant._sum.amount ?? 0,
      times: grant._count._all,
    }))
    .sort((a, b) => b.cards - a.cards)
}
