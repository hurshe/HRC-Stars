import type { Prisma, TaskStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { outranks, type CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'

/*
  Задачи идут строго вниз по иерархии: GM и AGM ставят менеджерам
  и супервайзерам, те — стаффу. Проверка делается здесь, а не в интерфейсе,
  потому что скрытая кнопка защитой не является.
*/

export type TaskScope = 'assigned' | 'authored' | 'all'

export async function listTasks(
  actor: CurrentUser,
  options: { scope: TaskScope; status?: TaskStatus },
) {
  const where: Prisma.TaskWhereInput = { locationId: actor.locationId }

  if (options.status) where.status = options.status

  if (options.scope === 'assigned') {
    // Задача может быть адресована лично, роли или позиции
    const positionCodes = actor.positions.map((position) => position.code)
    where.OR = [
      { assigneeId: actor.id },
      { assigneeRole: { code: actor.role.code } },
      { assigneePosition: { code: { in: positionCodes } } },
    ]
  } else if (options.scope === 'authored') {
    where.authorId = actor.id
  }

  const rows = await db.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      requiresApproval: true,
      completedAt: true,
      createdAt: true,
      author: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      assigneeRole: { select: { code: true } },
      assigneePosition: { select: { code: true, nameEn: true, namePl: true } },
      _count: { select: { comments: true } },
    },
  })

  // Просрочку считает сервис, а не страница: в компоненте вызов текущего
  // времени — нечистая операция, да и место домашней логике здесь
  const now = Date.now()
  return rows.map((task) => ({
    ...task,
    overdue: Boolean(
      task.dueAt &&
        task.dueAt.getTime() < now &&
        task.status !== 'ACCEPTED' &&
        task.status !== 'CANCELLED',
    ),
  }))
}

export type CreateTaskInput = {
  title: string
  description?: string
  target: string
  dueAt?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  requiresApproval: boolean
  repeatEveryDays?: number
}

export async function createTask(actor: CurrentUser, input: CreateTaskInput) {
  const [kind, id] = input.target.split(':')
  if (!kind || !id) return { ok: false as const, error: 'invalidTarget' as const }

  // Ставить задачу можно только тем, кто ниже уровнем
  if (kind === 'user') {
    const assignee = await db.user.findFirst({
      where: { id, locationId: actor.locationId, deletedAt: null },
      select: { id: true, role: { select: { level: true } } },
    })
    if (!assignee) return { ok: false as const, error: 'notFound' as const }
    if (!outranks(actor, assignee.role.level)) {
      return { ok: false as const, error: 'assigneeTooHigh' as const }
    }
  }

  if (kind === 'role') {
    const role = await db.role.findUnique({ where: { id }, select: { level: true } })
    if (!role) return { ok: false as const, error: 'notFound' as const }
    if (!outranks(actor, role.level)) {
      return { ok: false as const, error: 'assigneeTooHigh' as const }
    }
  }

  const task = await db.task.create({
    data: {
      locationId: actor.locationId,
      title: input.title,
      description: input.description || null,
      authorId: actor.id,
      assigneeId: kind === 'user' ? id : null,
      assigneeRoleId: kind === 'role' ? id : null,
      assigneePositionId: kind === 'position' ? id : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      priority: input.priority,
      requiresApproval: input.requiresApproval,
      repeatEveryDays: input.repeatEveryDays ?? null,
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'task.created',
    entityType: 'Task',
    entityId: task.id,
    locationId: actor.locationId,
    after: { title: input.title, target: input.target, priority: input.priority },
  })

  return { ok: true as const, taskId: task.id }
}

export async function changeTaskStatus(actor: CurrentUser, taskId: string, status: TaskStatus) {
  const task = await db.task.findFirst({
    where: { id: taskId, locationId: actor.locationId },
    select: {
      id: true,
      status: true,
      authorId: true,
      assigneeId: true,
      assigneeRoleId: true,
      assigneePositionId: true,
      requiresApproval: true,
    },
  })
  if (!task) return { ok: false as const, error: 'notFound' as const }

  const isAuthor = task.authorId === actor.id
  const isAssignee =
    task.assigneeId === actor.id ||
    (task.assigneeRoleId !== null && !task.assigneeId) ||
    (task.assigneePositionId !== null && !task.assigneeId)

  // Принимать работу может только автор: иначе исполнитель закрывал бы
  // задачу сам, и приёмка теряла бы смысл
  if (status === 'ACCEPTED' && !isAuthor) {
    return { ok: false as const, error: 'onlyAuthorAccepts' as const }
  }
  if (!isAuthor && !isAssignee) return { ok: false as const, error: 'notYourTask' as const }

  // Если приёмка не требуется, «выполнено» сразу считается принятым
  const finalStatus = status === 'DONE' && !task.requiresApproval ? 'ACCEPTED' : status

  await db.task.update({
    where: { id: task.id },
    data: {
      status: finalStatus,
      completedAt: finalStatus === 'DONE' || finalStatus === 'ACCEPTED' ? new Date() : null,
      acceptedAt: finalStatus === 'ACCEPTED' ? new Date() : null,
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'task.status.changed',
    entityType: 'Task',
    entityId: task.id,
    locationId: actor.locationId,
    before: { status: task.status },
    after: { status: finalStatus },
  })

  return { ok: true as const, status: finalStatus }
}

export async function addTaskComment(actor: CurrentUser, taskId: string, text: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, locationId: actor.locationId },
    select: { id: true },
  })
  if (!task) return { ok: false as const }

  await db.taskComment.create({ data: { taskId, authorId: actor.id, text } })
  return { ok: true as const }
}

export async function getTask(actor: CurrentUser, id: string) {
  return db.task.findFirst({
    where: { id, locationId: actor.locationId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueAt: true,
      requiresApproval: true,
      completedAt: true,
      acceptedAt: true,
      createdAt: true,
      authorId: true,
      assigneeId: true,
      author: { select: { firstName: true, lastName: true } },
      assignee: { select: { firstName: true, lastName: true } },
      assigneeRole: { select: { code: true } },
      assigneePosition: { select: { code: true, nameEn: true, namePl: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
}
