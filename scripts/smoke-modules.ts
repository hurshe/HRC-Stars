/*
  Сквозная проверка модулей на живой базе.

  Проходит путь, который в реальности проходит менеджер: создаёт тест,
  добавляет вопросы, публикует, назначает позиции, вносит бумажный результат,
  выдаёт Wild Card, оформляет заявку на ваучер и подтверждает её,
  заводит чек-лист и закрывает его. После каждого шага проверяет, что
  данные действительно попали в базу.

  Запуск: npx tsx scripts/smoke-modules.ts
*/
import 'dotenv/config'
import { db } from '../src/lib/db'
import { getCurrentUser } from '../src/server/auth/session'
import type { CurrentUser } from '../src/server/auth/session'
import {
  addQuestionToVersion,
  assignTest,
  createTest,
  publishVersion,
  recordPaperResult,
} from '../src/server/services/tests'
import { getTrainingMatrix, cellKey } from '../src/server/services/training-matrix'
import {
  approveVoucherRequest,
  getBalance,
  grantWildCards,
  requestVoucher,
} from '../src/server/services/wildcards'
import { createTemplate, openRun, saveItemResult, submitRun } from '../src/server/services/checklists'
import { createTask, changeTaskStatus } from '../src/server/services/tasks'

let failures = 0

function check(label: string, condition: boolean, detail = '') {
  if (!condition) failures++
  console.log(`  ${condition ? 'OK   ' : 'ПЛОХО'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  void getCurrentUser

  const admin = await db.user.findFirstOrThrow({
    where: { role: { code: 'SUPER_ADMIN' } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      locale: true,
      isTrainer: true,
      mustChangePassword: true,
      locationId: true,
      departmentScopeId: true,
      role: { select: { code: true, level: true, nameEn: true, namePl: true } },
      location: { select: { name: true } },
    },
  })

  const actor: CurrentUser = {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    fullName: `${admin.firstName} ${admin.lastName}`,
    locale: admin.locale,
    isTrainer: admin.isTrainer,
    mustChangePassword: admin.mustChangePassword,
    role: admin.role,
    locationId: admin.locationId,
    locationName: admin.location.name,
    departmentScopeId: admin.departmentScopeId,
    positions: [],
    viaPin: false,
  }

  const employee = await db.user.findFirst({
    where: { locationId: actor.locationId, role: { code: 'STAFF' } },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!employee) {
    console.error('Нет сотрудника со ролью STAFF — сначала заведите его в интерфейсе')
    process.exit(1)
  }

  console.log('\nТЕСТЫ И МАТРИЦА')
  console.log('─'.repeat(78))

  const test = await createTest(actor, {
    title: `Beverage Knowledge Test ${Date.now().toString().slice(-5)}`,
    category: 'Beverage',
    passThreshold: 75,
  })
  check('тест создан', Boolean(test.id))

  const version = await db.testVersion.findFirstOrThrow({
    where: { testId: test.id },
    select: { id: true },
  })

  const added = await addQuestionToVersion(actor, version.id, {
    type: 'SINGLE_CHOICE',
    text: 'Which of the following is the main ingredient in a Mojito?',
    options: ['Rum', 'Tequila', 'Vodka', 'Gin'],
    answer: '0',
    points: 10,
  })
  check('вопрос добавлен', added !== null && !added.locked)

  const published = await publishVersion(actor, version.id)
  check('версия опубликована', published.ok, published.ok ? `max ${published.maxScore}` : published.error)

  const repeat = await publishVersion(actor, version.id)
  check('повторная публикация запрещена', !repeat.ok && repeat.error === 'alreadyPublished')

  const locked = await addQuestionToVersion(actor, version.id, {
    type: 'SHORT_TEXT',
    text: 'Locked?',
    options: [],
    answer: ['no'],
    points: 1,
  })
  check('в опубликованную версию вопрос не добавить', locked !== null && locked.locked === true)

  const serverPosition = await db.position.findFirstOrThrow({ where: { code: 'SERVER' } })
  await assignTest(actor, test.id, { positionId: serverPosition.id, mandatory: true })
  check('тест назначен позиции SERVER', true)

  const paper = await recordPaperResult(actor, {
    testVersionId: version.id,
    userId: employee.id,
    score: 8,
  })
  check('бумажный результат внесён', paper !== null)

  const attempt = await db.testAttempt.findFirstOrThrow({
    where: { userId: employee.id, testVersionId: version.id },
    select: { percent: true, passed: true, appliedThreshold: true, mode: true },
  })
  check(
    'процент посчитан от максимума версии',
    attempt.percent === 80,
    `${attempt.percent}% при 8 из 10`,
  )
  check('порог сохранён в попытке', attempt.appliedThreshold === 75)
  check('оценка «зачтено» по порогу 75%', attempt.passed === true)
  check('режим отмечен как бумажный', attempt.mode === 'PAPER')

  const matrix = await getTrainingMatrix(actor, {})
  const hasColumn = matrix.tests.some((item) => item.id === test.id)
  check('тест появился колонкой в матрице', hasColumn)
  const cell = matrix.testCells[cellKey(employee.id, test.id)]
  check('результат виден в ячейке матрицы', cell?.percent === 80)

  console.log('\nWILD CARDS')
  console.log('─'.repeat(78))

  const before = await getBalance(employee.id)
  const granted = await grantWildCards(actor, {
    userId: employee.id,
    amount: 5,
    reason: 'Excellent guest feedback',
  })
  check('карты выданы', granted.ok)

  const afterGrant = await getBalance(employee.id)
  check('баланс вырос на 5', afterGrant.available === before.available + 5)

  const voucher = await db.voucherType.findFirstOrThrow({
    where: { locationId: actor.locationId },
    orderBy: { cost: 'asc' },
    select: { id: true, cost: true, name: true },
  })

  const employeeActor: CurrentUser = { ...actor, id: employee.id }
  const request = await requestVoucher(employeeActor, voucher.id)
  check('заявка на ваучер подана', request.ok)

  const reserved = await getBalance(employee.id)
  check(
    'карты зарезервированы, а не списаны',
    reserved.reserved === voucher.cost && reserved.total === afterGrant.total,
    `резерв ${reserved.reserved}, всего ${reserved.total}`,
  )
  check(
    'доступный баланс уменьшился на стоимость',
    reserved.available === afterGrant.available - voucher.cost,
  )

  if (request.ok) {
    const approved = await approveVoucherRequest(actor, request.requestId)
    check('заявка подтверждена', approved.ok)

    const afterApprove = await getBalance(employee.id)
    check(
      'после подтверждения карты списаны',
      afterApprove.total === afterGrant.total - voucher.cost && afterApprove.reserved === 0,
      `всего ${afterApprove.total}, резерв ${afterApprove.reserved}`,
    )
  }

  console.log('\nЧЕК-ЛИСТЫ')
  console.log('─'.repeat(78))

  const template = await createTemplate(actor, {
    name: `Opening Checklist ${Date.now().toString().slice(-5)}`,
    frequency: 'DAILY',
    shift: 'OPENING',
    requiresVerification: false,
    items: [
      { label: 'Check beer taps', type: 'CHECKBOX', required: true },
      { label: 'Check fridge temperature', type: 'CHECKBOX', required: true },
    ],
  })
  check('шаблон создан', Boolean(template.id))

  const run = await openRun(actor, template.id)
  check('прохождение открыто', run !== null)

  if (run) {
    const items = await db.checklistItemTemplate.findMany({
      where: { templateId: template.id },
      select: { id: true },
    })

    const early = await submitRun(actor, run.id)
    check(
      'незаполненный чек-лист не отправляется',
      !early.ok && early.error === 'requiredMissing',
      early.ok ? '' : `не хватает ${early.missing}`,
    )

    for (const item of items) {
      await saveItemResult(actor, run.id, item.id, true)
    }

    const submitted = await submitRun(actor, run.id)
    check('заполненный чек-лист отправлен', submitted.ok)

    const stored = await db.checklistRun.findUniqueOrThrow({
      where: { id: run.id },
      select: { status: true },
    })
    check('без приёмки статус сразу VERIFIED', stored.status === 'VERIFIED')

    const afterSubmit = await saveItemResult(actor, run.id, items[0].id, false)
    check('отправленный чек-лист не редактируется', !afterSubmit.ok)
  }

  console.log('\nЗАДАЧИ')
  console.log('─'.repeat(78))

  const task = await createTask(actor, {
    title: 'Review Anna Kowalska evaluation',
    target: `user:${employee.id}`,
    priority: 'HIGH',
    requiresApproval: true,
  })
  check('задача создана', task.ok)

  const superAdminRole = await db.role.findFirstOrThrow({ where: { code: 'SUPER_ADMIN' } })
  const tooHigh = await createTask(actor, {
    title: 'Should fail',
    target: `role:${superAdminRole.id}`,
    priority: 'LOW',
    requiresApproval: false,
  })
  check(
    'задачу вверх по иерархии поставить нельзя',
    !tooHigh.ok && tooHigh.error === 'assigneeTooHigh',
  )

  if (task.ok) {
    const employeeAccepts = await changeTaskStatus(employeeActor, task.taskId, 'ACCEPTED')
    check(
      'исполнитель не может принять работу сам',
      !employeeAccepts.ok && employeeAccepts.error === 'onlyAuthorAccepts',
    )

    const done = await changeTaskStatus(employeeActor, task.taskId, 'DONE')
    check('исполнитель отмечает выполнение', done.ok && done.status === 'DONE')

    const accepted = await changeTaskStatus(actor, task.taskId, 'ACCEPTED')
    check('автор принимает работу', accepted.ok && accepted.status === 'ACCEPTED')
  }

  console.log('\n' + '═'.repeat(78))
  if (failures > 0) {
    console.error(`Провалено проверок: ${failures}`)
    process.exitCode = 1
  } else {
    console.log('Все проверки пройдены.')
  }

  await db.$disconnect()
}

main()
