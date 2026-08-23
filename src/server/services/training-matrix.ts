import { db } from '@/lib/db'
import type { CurrentUser } from '@/server/auth/session'
import { getSettingNumber } from './settings'
import { DEFAULT_PASS_THRESHOLD } from './tests'

/*
  Матрица обучения — живая замена листов SERVER TEST SCORES и BARTENDER
  TEST SCORE из таблицы Excel.

  Отличия от таблицы, ради которых всё и делалось:
  1. Процент считается от максимума ТОЙ версии теста, которую человек сдавал.
     В таблице максимум менялся, а старые проценты оставались — сравнивать
     людей между собой по ним было нельзя.
  2. Цвет ячейки вычисляется от текущих порогов, а не красится руками.
  3. Колонки складываются из назначений теста, а не из структуры листа:
     появилась новая позиция — матрица подстроилась сама.
*/

export type MatrixEmployee = {
  id: string
  fullName: string
  employeeNumber: string | null
  status: string
  isTrainer: boolean
  hiredAt: string | null
  positions: string[]
}

export type MatrixTest = { id: string; title: string; category: string | null }

export type MatrixRequirement = { id: string; name: string }

export type MatrixTestCell = {
  percent: number | null
  passed: boolean | null
  score: number | null
  maxScore: number
  mode: string
  date: string | null
  attempts: number
}

export type MatrixDocCell = {
  status: string
  validUntil: string | null
}

export type TrainingMatrix = {
  employees: MatrixEmployee[]
  tests: MatrixTest[]
  requirements: MatrixRequirement[]
  /// Ключ "userId:testId"
  testCells: Record<string, MatrixTestCell>
  /// Ключ "userId:requirementId"
  docCells: Record<string, MatrixDocCell>
  bands: { danger: number; warning: number }
}

export const cellKey = (userId: string, columnId: string) => `${userId}:${columnId}`

export async function getTrainingMatrix(
  actor: CurrentUser,
  filters: { positionId?: string } = {},
): Promise<TrainingMatrix> {
  const employees = await db.user.findMany({
    where: {
      locationId: actor.locationId,
      deletedAt: null,
      // Уволенных в матрице не показываем: она про действующую команду
      status: { in: ['INVITED', 'ACTIVE', 'ON_LEAVE'] },
      ...(filters.positionId
        ? { positions: { some: { positionId: filters.positionId, endedAt: null } } }
        : {}),
      ...(actor.departmentScopeId
        ? {
            positions: {
              some: { position: { departmentId: actor.departmentScopeId }, endedAt: null },
            },
          }
        : {}),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNumber: true,
      status: true,
      isTrainer: true,
      hiredAt: true,
      positions: {
        where: { endedAt: null },
        select: { positionId: true, position: { select: { code: true } } },
      },
    },
  })

  const userIds = employees.map((employee) => employee.id)
  const positionIds = [
    ...new Set(employees.flatMap((employee) => employee.positions.map((p) => p.positionId))),
  ]

  // Колонки — это тесты, назначенные позициям этих людей, их ролям
  // или лично им. Именно так матрица подстраивается под состав команды
  const assignments = await db.testAssignment.findMany({
    where: {
      test: { locationId: actor.locationId, deletedAt: null, isActive: true },
      OR: [
        { positionId: { in: positionIds } },
        { userId: { in: userIds } },
        { roleId: { not: null } },
      ],
    },
    select: {
      testId: true,
      test: { select: { id: true, title: true, category: true } },
    },
  })

  const testMap = new Map<string, MatrixTest>()
  for (const assignment of assignments) {
    testMap.set(assignment.test.id, {
      id: assignment.test.id,
      title: assignment.test.title,
      category: assignment.test.category,
    })
  }
  const tests = [...testMap.values()].sort((a, b) => a.title.localeCompare(b.title))

  // Лучшая засчитанная попытка на каждую пару «человек — тест».
  // Берём именно лучшую, а не последнюю: пересдача нужна, чтобы улучшить
  // результат, и худшая попытка не должна перечёркивать успешную
  const attempts =
    tests.length > 0 && userIds.length > 0
      ? await db.testAttempt.findMany({
          where: {
            userId: { in: userIds },
            status: 'SUBMITTED',
            testVersion: { testId: { in: tests.map((test) => test.id) } },
          },
          orderBy: [{ percent: 'desc' }, { submittedAt: 'desc' }],
          select: {
            userId: true,
            percent: true,
            score: true,
            passed: true,
            mode: true,
            submittedAt: true,
            testVersion: { select: { testId: true, maxScore: true } },
          },
        })
      : []

  const testCells: Record<string, MatrixTestCell> = {}
  const attemptCounts = new Map<string, number>()

  for (const attempt of attempts) {
    const key = cellKey(attempt.userId, attempt.testVersion.testId)
    attemptCounts.set(key, (attemptCounts.get(key) ?? 0) + 1)

    // Первая попавшаяся — уже лучшая, дальше только считаем количество
    if (!testCells[key]) {
      testCells[key] = {
        percent: attempt.percent,
        passed: attempt.passed,
        score: attempt.score,
        maxScore: attempt.testVersion.maxScore,
        mode: attempt.mode,
        date: attempt.submittedAt?.toISOString() ?? null,
        attempts: 0,
      }
    }
  }
  for (const [key, count] of attemptCounts) {
    if (testCells[key]) testCells[key].attempts = count
  }

  // Обязательные документы — это колонки CV / Handbook / Job Description
  // из правой части таблицы Excel
  const requirements = await db.documentRequirement.findMany({
    where: {
      locationId: actor.locationId,
      isActive: true,
      OR: [{ positionId: null }, { positionId: { in: positionIds } }],
    },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, nameEn: true, namePl: true },
  })

  const employeeDocuments =
    requirements.length > 0 && userIds.length > 0
      ? await db.employeeDocument.findMany({
          where: { userId: { in: userIds }, requirementId: { in: requirements.map((r) => r.id) } },
          select: { userId: true, requirementId: true, status: true, validUntil: true },
        })
      : []

  const docCells: Record<string, MatrixDocCell> = {}
  for (const document of employeeDocuments) {
    docCells[cellKey(document.userId, document.requirementId)] = {
      status: document.status,
      validUntil: document.validUntil?.toISOString() ?? null,
    }
  }

  const warning = await getSettingNumber('test.default_pass_threshold', DEFAULT_PASS_THRESHOLD)
  const bands = { danger: 60, warning }

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      fullName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNumber: employee.employeeNumber,
      status: employee.status,
      isTrainer: employee.isTrainer,
      hiredAt: employee.hiredAt?.toISOString() ?? null,
      positions: employee.positions.map((p) => p.position.code),
    })),
    tests,
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      name: requirement.nameEn,
    })),
    testCells,
    docCells,
    bands,
  }
}
