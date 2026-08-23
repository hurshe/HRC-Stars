import { db } from '@/lib/db'
import { getPermissions, type CurrentUser } from '@/server/auth/session'
import { businessDateOf } from './checklists'
import { listAssignedDocuments } from './documents'
import { listMyTests } from './tests'
import { getBalance } from './wildcards'

/*
  Дашборд собирается из того, что человеку реально доступно: у стаффа это
  его собственные дела, у менеджера — ещё и состояние команды. Проверяем
  права, а не роль: если GM выдал супервайзеру право видеть отчёты,
  дашборд обязан это учесть без правки кода.
*/

export type PersonalSummary = {
  documentsToRead: number
  testsToTake: number
  openTasks: number
  wildCards: number
}

export type ManagerSummary = {
  openChecklists: number
  pendingVouchers: number
  overdueTasks: number
  expiringDocuments: number
  staffCount: number
}

export async function getPersonalSummary(actor: CurrentUser): Promise<PersonalSummary> {
  const positionCodes = actor.positions.map((position) => position.code)

  const [documents, tests, tasks, balance] = await Promise.all([
    listAssignedDocuments(actor),
    listMyTests(actor),
    db.task.count({
      where: {
        locationId: actor.locationId,
        status: { in: ['NEW', 'IN_PROGRESS'] },
        OR: [
          { assigneeId: actor.id },
          { assigneeRole: { code: actor.role.code } },
          { assigneePosition: { code: { in: positionCodes } } },
        ],
      },
    }),
    getBalance(actor.id),
  ])

  return {
    documentsToRead: documents.filter(
      (item) => item.requiresAcknowledgement && !item.acknowledgedAt,
    ).length,
    testsToTake: tests.filter((item) => item.best === null && item.published !== null).length,
    openTasks: tasks,
    wildCards: balance.available,
  }
}

export async function getManagerSummary(actor: CurrentUser): Promise<ManagerSummary | null> {
  const permissions = await getPermissions(actor.id)
  // Сводка по команде показывается только тем, кто вправе её видеть
  if (!permissions.has('employee.view')) return null

  const today = businessDateOf()
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const [templates, verifiedToday, pendingVouchers, overdueTasks, expiringDocuments, staffCount] =
    await Promise.all([
      db.checklistTemplate.count({
        where: { locationId: actor.locationId, isActive: true, frequency: 'DAILY' },
      }),
      db.checklistRun.count({
        where: {
          locationId: actor.locationId,
          businessDate: today,
          status: { in: ['SUBMITTED', 'VERIFIED'] },
        },
      }),
      permissions.has('wildcard.request.approve')
        ? db.voucherRequest.count({
            where: { status: 'PENDING', user: { locationId: actor.locationId } },
          })
        : Promise.resolve(0),
      db.task.count({
        where: {
          locationId: actor.locationId,
          status: { in: ['NEW', 'IN_PROGRESS'] },
          dueAt: { lt: new Date() },
        },
      }),
      db.employeeDocument.count({
        where: {
          user: { locationId: actor.locationId, deletedAt: null },
          validUntil: { lte: soon },
          status: { not: 'MISSING' },
        },
      }),
      db.user.count({
        where: {
          locationId: actor.locationId,
          deletedAt: null,
          status: { in: ['ACTIVE', 'ON_LEAVE'] },
        },
      }),
    ])

  return {
    openChecklists: Math.max(0, templates - verifiedToday),
    pendingVouchers,
    overdueTasks,
    expiringDocuments,
    staffCount,
  }
}
