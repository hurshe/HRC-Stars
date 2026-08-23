import type { Prisma, QuestionType } from '@prisma/client'
import { db } from '@/lib/db'
import type { CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'
import { getSetting } from './settings'

export const DEFAULT_PASS_THRESHOLD = 80

// ─── Проверка ответов ─────────────────────────────────────────────────────

/// Сравнение ответа с эталоном. Вынесено отдельно, потому что это
/// единственное место, где тип вопроса влияет на логику, и его нужно
/// уметь проверить тестом, не поднимая всю систему.
export function isAnswerCorrect(type: QuestionType, expected: unknown, given: unknown): boolean {
  switch (type) {
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE':
      return String(expected) === String(given)

    case 'MULTIPLE_CHOICE': {
      // Порядок выбора не важен, состав — важен
      const a = new Set((Array.isArray(expected) ? expected : []).map(String))
      const b = new Set((Array.isArray(given) ? given : []).map(String))
      return a.size === b.size && [...a].every((value) => b.has(value))
    }

    case 'SHORT_TEXT': {
      // Регистр и лишние пробелы не должны считаться ошибкой:
      // человек пишет ответ руками, а не выбирает из списка
      const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase()
      const variants = Array.isArray(expected) ? expected : [expected]
      return variants.some((variant) => normalise(variant) === normalise(given))
    }

    case 'ORDERING':
    case 'MATCHING':
      // Здесь порядок как раз важен
      return JSON.stringify(expected) === JSON.stringify(given)

    default:
      return false
  }
}

// ─── Тесты ────────────────────────────────────────────────────────────────

export async function listTests(actor: CurrentUser, search?: string) {
  const where: Prisma.TestWhereInput = { locationId: actor.locationId, deletedAt: null }
  if (search) where.title = { contains: search, mode: 'insensitive' }

  return db.test.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      category: true,
      isActive: true,
      updatedAt: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          isPublished: true,
          maxScore: true,
          passThreshold: true,
          _count: { select: { questions: true, attempts: true } },
        },
      },
      assignments: {
        select: { position: { select: { code: true, nameEn: true, namePl: true } } },
      },
    },
  })
}

export async function getTest(actor: CurrentUser, id: string) {
  return db.test.findFirst({
    where: { id, locationId: actor.locationId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      isActive: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          maxScore: true,
          passThreshold: true,
          timeLimitMinutes: true,
          attemptsAllowed: true,
          shuffleQuestions: true,
          isPublished: true,
          publishedAt: true,
          questions: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sortOrder: true,
              points: true,
              question: {
                select: { id: true, type: true, text: true, options: true, answer: true },
              },
            },
          },
          _count: { select: { attempts: true } },
        },
      },
      assignments: {
        select: {
          id: true,
          mandatory: true,
          dueAt: true,
          repeatEveryDays: true,
          position: { select: { id: true, code: true, nameEn: true, namePl: true } },
          role: { select: { code: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  })
}

export async function createTest(
  actor: CurrentUser,
  input: { title: string; description?: string; category?: string; timeLimitMinutes?: number; passThreshold?: number },
) {
  const test = await db.$transaction(async (tx) => {
    const created = await tx.test.create({
      data: {
        locationId: actor.locationId,
        title: input.title,
        description: input.description || null,
        category: input.category || null,
        createdById: actor.id,
      },
    })

    // Тест без версии бессмысленен, поэтому черновик первой версии
    // создаётся сразу. Максимальный балл посчитается при публикации
    await tx.testVersion.create({
      data: {
        testId: created.id,
        versionNumber: 1,
        maxScore: 0,
        passThreshold: input.passThreshold ?? null,
        timeLimitMinutes: input.timeLimitMinutes ?? null,
      },
    })

    return created
  })

  await writeAudit({
    actorId: actor.id,
    action: 'test.created',
    entityType: 'Test',
    entityId: test.id,
    locationId: actor.locationId,
    after: { title: input.title },
  })

  return test
}

export type QuestionInput = {
  type: QuestionType
  text: string
  options: unknown
  answer: unknown
  points: number
  explanation?: string
}

/// Вопрос создаётся в банке и сразу привязывается к версии: банк нужен,
/// чтобы тот же вопрос можно было переиспользовать в другом тесте
export async function addQuestionToVersion(
  actor: CurrentUser,
  testVersionId: string,
  input: QuestionInput,
) {
  const version = await db.testVersion.findFirst({
    where: { id: testVersionId, test: { locationId: actor.locationId } },
    select: { id: true, isPublished: true, testId: true, _count: { select: { questions: true } } },
  })
  if (!version) return null
  // Опубликованную версию менять нельзя: люди уже сдавали именно её
  if (version.isPublished) return { locked: true as const }

  let bank = await db.questionBank.findFirst({
    where: { locationId: actor.locationId, isActive: true },
    select: { id: true },
  })
  bank ??= await db.questionBank.create({
    data: { locationId: actor.locationId, name: 'Default' },
    select: { id: true },
  })

  const question = await db.question.create({
    data: {
      bankId: bank.id,
      type: input.type,
      text: input.text,
      explanation: input.explanation || null,
      options: input.options as Prisma.InputJsonValue,
      answer: input.answer as Prisma.InputJsonValue,
      points: input.points,
    },
    select: { id: true },
  })

  await db.testVersionQuestion.create({
    data: {
      testVersionId,
      questionId: question.id,
      sortOrder: version._count.questions,
      points: input.points,
    },
  })

  return { locked: false as const, questionId: question.id }
}

/// Публикация фиксирует максимальный балл. После неё версия неизменна:
/// именно поэтому в системе не может повториться история из Excel,
/// где проценты остались от прежнего максимума
export async function publishVersion(actor: CurrentUser, testVersionId: string) {
  const version = await db.testVersion.findFirst({
    where: { id: testVersionId, test: { locationId: actor.locationId } },
    select: {
      id: true,
      isPublished: true,
      testId: true,
      questions: { select: { points: true } },
    },
  })
  if (!version) return { ok: false as const, error: 'notFound' as const }
  if (version.isPublished) return { ok: false as const, error: 'alreadyPublished' as const }
  if (version.questions.length === 0) return { ok: false as const, error: 'noQuestions' as const }

  const maxScore = version.questions.reduce((sum, question) => sum + question.points, 0)

  await db.testVersion.update({
    where: { id: testVersionId },
    data: { maxScore, isPublished: true, publishedAt: new Date() },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'test.version.published',
    entityType: 'TestVersion',
    entityId: testVersionId,
    locationId: actor.locationId,
    after: { maxScore, questions: version.questions.length },
  })

  return { ok: true as const, maxScore }
}

export async function assignTest(
  actor: CurrentUser,
  testId: string,
  target: { positionId?: string; roleId?: string; userId?: string; dueAt?: string; mandatory: boolean; repeatEveryDays?: number },
) {
  await db.testAssignment.create({
    data: {
      testId,
      positionId: target.positionId || null,
      roleId: target.roleId || null,
      userId: target.userId || null,
      dueAt: target.dueAt ? new Date(target.dueAt) : null,
      mandatory: target.mandatory,
      repeatEveryDays: target.repeatEveryDays ?? null,
      createdById: actor.id,
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'test.assigned',
    entityType: 'Test',
    entityId: testId,
    locationId: actor.locationId,
    after: target as unknown as Prisma.InputJsonValue,
  })
}

// ─── Прохождение ──────────────────────────────────────────────────────────

async function resolveThreshold(version: { passThreshold: number | null }): Promise<number> {
  if (version.passThreshold != null) return version.passThreshold
  return (await getSetting<number>('test.default_pass_threshold')) ?? DEFAULT_PASS_THRESHOLD
}

export async function startAttempt(actor: CurrentUser, testId: string) {
  const version = await db.testVersion.findFirst({
    where: { testId, isPublished: true, test: { locationId: actor.locationId, isActive: true } },
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      attemptsAllowed: true,
      timeLimitMinutes: true,
      passThreshold: true,
      shuffleQuestions: true,
    },
  })
  if (!version) return { ok: false as const, error: 'notPublished' as const }

  const used = await db.testAttempt.count({
    where: { testVersionId: version.id, userId: actor.id, status: { not: 'IN_PROGRESS' } },
  })
  if (version.attemptsAllowed != null && used >= version.attemptsAllowed) {
    return { ok: false as const, error: 'noAttemptsLeft' as const }
  }

  // Незавершённую попытку продолжаем, а не создаём вторую: иначе обрыв связи
  // сжигал бы попытку
  const existing = await db.testAttempt.findFirst({
    where: { testVersionId: version.id, userId: actor.id, status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (existing) return { ok: true as const, attemptId: existing.id }

  const attempt = await db.testAttempt.create({
    data: {
      testVersionId: version.id,
      userId: actor.id,
      mode: 'ONLINE',
      appliedThreshold: await resolveThreshold(version),
    },
    select: { id: true },
  })

  return { ok: true as const, attemptId: attempt.id }
}

export async function getAttempt(actor: CurrentUser, attemptId: string) {
  return db.testAttempt.findFirst({
    where: { id: attemptId, userId: actor.id },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      percent: true,
      passed: true,
      appliedThreshold: true,
      testVersion: {
        select: {
          id: true,
          versionNumber: true,
          maxScore: true,
          timeLimitMinutes: true,
          shuffleQuestions: true,
          showAnswersAfter: true,
          test: { select: { id: true, title: true, description: true } },
          questions: {
            orderBy: { sortOrder: 'asc' },
            select: {
              points: true,
              question: {
                select: { id: true, type: true, text: true, options: true, explanation: true },
              },
            },
          },
        },
      },
      answers: { select: { questionId: true, value: true, isCorrect: true, points: true } },
    },
  })
}

/// Подсчёт результата. Порог берётся тот, что был записан при старте попытки:
/// если менеджер поменяет порог завтра, вчерашние результаты не переоценятся.
export async function submitAttempt(
  actor: CurrentUser,
  attemptId: string,
  answers: Record<string, unknown>,
) {
  const attempt = await db.testAttempt.findFirst({
    where: { id: attemptId, userId: actor.id, status: 'IN_PROGRESS' },
    select: {
      id: true,
      appliedThreshold: true,
      testVersion: {
        select: {
          id: true,
          maxScore: true,
          passThreshold: true,
          test: { select: { id: true, title: true } },
          questions: {
            select: {
              points: true,
              question: { select: { id: true, type: true, answer: true } },
            },
          },
        },
      },
    },
  })
  if (!attempt) return null

  let score = 0
  const rows: Prisma.TestAnswerCreateManyInput[] = []

  for (const link of attempt.testVersion.questions) {
    const given = answers[link.question.id]
    const correct = isAnswerCorrect(link.question.type, link.question.answer, given)
    const earned = correct ? link.points : 0
    score += earned

    rows.push({
      attemptId: attempt.id,
      questionId: link.question.id,
      value: (given ?? null) as Prisma.InputJsonValue,
      isCorrect: correct,
      points: earned,
    })
  }

  const maxScore = attempt.testVersion.maxScore || 1
  const percent = Math.round((score / maxScore) * 1000) / 10
  const threshold = attempt.appliedThreshold ?? (await resolveThreshold(attempt.testVersion))

  await db.$transaction([
    db.testAnswer.deleteMany({ where: { attemptId: attempt.id } }),
    db.testAnswer.createMany({ data: rows }),
    db.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score,
        percent,
        passed: percent >= threshold,
        appliedThreshold: threshold,
      },
    }),
  ])

  return { score, percent, passed: percent >= threshold, threshold, maxScore }
}

/// Ручной ввод результата бумажной сдачи. Половина результатов в текущей
/// таблице — бумажные, и переход должен быть плавным.
export async function recordPaperResult(
  actor: CurrentUser,
  input: { testVersionId: string; userId: string; score: number; date?: string; note?: string },
) {
  const version = await db.testVersion.findFirst({
    where: { id: input.testVersionId, test: { locationId: actor.locationId } },
    select: { id: true, maxScore: true, passThreshold: true },
  })
  if (!version) return null

  const threshold = await resolveThreshold(version)
  const maxScore = version.maxScore || 1
  const percent = Math.round((input.score / maxScore) * 1000) / 10

  const attempt = await db.testAttempt.create({
    data: {
      testVersionId: version.id,
      userId: input.userId,
      mode: 'PAPER',
      status: 'SUBMITTED',
      startedAt: input.date ? new Date(input.date) : new Date(),
      submittedAt: input.date ? new Date(input.date) : new Date(),
      score: input.score,
      percent,
      passed: percent >= threshold,
      appliedThreshold: threshold,
      gradedById: actor.id,
      note: input.note || null,
    },
    select: { id: true },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'test.paper_result.recorded',
    entityType: 'TestAttempt',
    entityId: attempt.id,
    locationId: actor.locationId,
    after: { userId: input.userId, score: input.score, percent },
  })

  return attempt
}

/// Тесты, назначенные конкретному сотруднику: лично, его роли или позиции.
/// Показываем лучший результат, а не последний: пересдают, чтобы улучшить.
export async function listMyTests(actor: CurrentUser) {
  const positionCodes = actor.positions.map((position) => position.code)

  const assignments = await db.testAssignment.findMany({
    where: {
      test: { locationId: actor.locationId, deletedAt: null, isActive: true },
      OR: [
        { userId: actor.id },
        { role: { code: actor.role.code } },
        { position: { code: { in: positionCodes } } },
      ],
    },
    select: {
      id: true,
      dueAt: true,
      mandatory: true,
      test: {
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          versions: {
            where: { isPublished: true },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { id: true, maxScore: true, timeLimitMinutes: true, attemptsAllowed: true },
          },
        },
      },
    },
  })

  const testIds = assignments.map((assignment) => assignment.test.id)
  const attempts = testIds.length
    ? await db.testAttempt.findMany({
        where: {
          userId: actor.id,
          status: { not: 'IN_PROGRESS' },
          testVersion: { testId: { in: testIds } },
        },
        orderBy: [{ percent: 'desc' }],
        select: {
          percent: true,
          passed: true,
          submittedAt: true,
          testVersion: { select: { testId: true } },
        },
      })
    : []

  const best = new Map<string, (typeof attempts)[number]>()
  for (const attempt of attempts) {
    if (!best.has(attempt.testVersion.testId)) best.set(attempt.testVersion.testId, attempt)
  }

  const inProgress = testIds.length
    ? await db.testAttempt.findMany({
        where: {
          userId: actor.id,
          status: 'IN_PROGRESS',
          testVersion: { testId: { in: testIds } },
        },
        select: { id: true, testVersion: { select: { testId: true } } },
      })
    : []
  const openAttempts = new Map(inProgress.map((a) => [a.testVersion.testId, a.id]))

  // Один и тот же тест может быть назначен и роли, и позиции — показываем один раз
  const seen = new Set<string>()
  return assignments
    .filter((assignment) => {
      if (seen.has(assignment.test.id)) return false
      seen.add(assignment.test.id)
      return true
    })
    .map((assignment) => ({
      assignmentId: assignment.id,
      dueAt: assignment.dueAt,
      mandatory: assignment.mandatory,
      test: assignment.test,
      published: assignment.test.versions[0] ?? null,
      best: best.get(assignment.test.id) ?? null,
      openAttemptId: openAttempts.get(assignment.test.id) ?? null,
    }))
}
