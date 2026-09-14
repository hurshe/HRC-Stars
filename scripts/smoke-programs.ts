/*
  Сквозная проверка программ обучения и сертификатов на живой базе.

  Проходит путь онбординга: менеджер собирает программу из теста, документа
  и практики, записывает сотрудника, тот читает документ, куратор отмечает
  практику, менеджер выдаёт сертификат. Проверяет предохранители: без всех
  шагов сертификат не выдаётся, свою практику не подтвердить, после выдачи
  прогресс заморожен, PDF реально лежит в хранилище и отдаётся по ссылке.

  Требует запущенных Postgres и MinIO (docker compose up -d).
  Запуск: npx tsx scripts/smoke-programs.ts
  Сохранить выданный PDF для просмотра: SMOKE_PDF_OUT=cert.pdf npx tsx scripts/smoke-programs.ts
*/
import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import { db } from '../src/lib/db'
import type { CurrentUser } from '../src/server/auth/session'
import { createDocument } from '../src/server/services/documents'
import {
  addQuestionToVersion,
  createTest,
  publishVersion,
  recordPaperResult,
} from '../src/server/services/tests'
import {
  acknowledgeStepDocument,
  addProgramStep,
  completeEnrollment,
  createProgram,
  enrollInProgram,
  getCertificateDownload,
  getEnrollment,
  listCertificates,
  setPracticeStep,
} from '../src/server/services/programs'

let failures = 0

function check(label: string, condition: boolean, detail = '') {
  if (!condition) failures++
  console.log(`  ${condition ? 'OK   ' : 'ПЛОХО'} ${label}${detail ? ` — ${detail}` : ''}`)
}

/// Настоящий CurrentUser из базы — с реальной ролью и позициями,
/// чтобы проверки прав шли так же, как в приложении
async function toActor(userId: string): Promise<CurrentUser> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
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
      positions: {
        where: { endedAt: null },
        select: { isPrimary: true, position: { select: { code: true, nameEn: true, namePl: true } } },
      },
    },
  })

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    locale: user.locale,
    isTrainer: user.isTrainer,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    locationId: user.locationId,
    locationName: user.location.name,
    departmentScopeId: user.departmentScopeId,
    positions: user.positions.map((entry) => ({ ...entry.position, isPrimary: entry.isPrimary })),
    viaPin: false,
  }
}

async function main() {
  const admin = await db.user.findFirstOrThrow({
    where: { role: { code: 'SUPER_ADMIN' }, deletedAt: null },
    select: { id: true },
  })
  const actor = await toActor(admin.id)

  const staff = await db.user.findFirst({
    where: { locationId: actor.locationId, role: { code: 'STAFF' }, deletedAt: null },
    select: { id: true },
  })
  if (!staff) {
    console.error('Нет сотрудника со ролью STAFF — сначала заведите его в интерфейсе')
    process.exit(1)
  }
  const employee = await toActor(staff.id)
  const suffix = Date.now().toString().slice(-5)

  console.log('\nПРОГРАММЫ И СЕРТИФИКАТЫ')
  console.log('─'.repeat(78))

  // Фикстуры: тест, который сотрудник уже сдал на бумаге, и учебный документ
  const test = await createTest(actor, {
    title: `Food Safety ${suffix}`,
    category: 'Safety',
    passThreshold: 70,
  })
  const version = await db.testVersion.findFirstOrThrow({
    where: { testId: test.id },
    select: { id: true },
  })
  await addQuestionToVersion(actor, version.id, {
    type: 'SINGLE_CHOICE',
    text: 'At what temperature should cold food be stored?',
    options: ['Below 5°C', 'Below 15°C', 'Room temperature'],
    answer: '0',
    points: 10,
  })
  await publishVersion(actor, version.id)
  await recordPaperResult(actor, { testVersionId: version.id, userId: employee.id, score: 9 })

  const handbook = await createDocument(actor, {
    space: 'TRAINING',
    title: `Server Handbook ${suffix}`,
    tags: [],
    content: 'Welcome to Hard Rock Cafe.',
  })
  const contract = await createDocument(actor, {
    space: 'HR',
    title: `Contract ${suffix}`,
    tags: [],
    content: 'Confidential',
  })

  const serverPosition = await db.position.findFirstOrThrow({ where: { code: 'SERVER' } })
  const program = await createProgram(actor, {
    name: `Onboarding Server ${suffix}`,
    type: 'ONBOARDING',
    positionId: serverPosition.id,
  })
  check('программа создана', program.ok)
  if (!program.ok) return finish()

  const testStep = await addProgramStep(actor, program.programId, {
    type: 'TEST',
    refId: test.id,
    required: true,
  })
  const storedTestStep = testStep.ok
    ? await db.programStep.findUniqueOrThrow({ where: { id: testStep.stepId }, select: { title: true } })
    : null
  check(
    'шаг-тест добавлен, название взято из теста',
    testStep.ok && storedTestStep?.title === test.title ? true : false,
    storedTestStep?.title,
  )

  const documentStep = await addProgramStep(actor, program.programId, {
    type: 'DOCUMENT',
    refId: handbook.id,
    required: true,
  })
  check('шаг-документ добавлен', documentStep.ok)

  const practiceStep = await addProgramStep(actor, program.programId, {
    type: 'PRACTICE',
    title: 'Shadow shift with a trainer',
    required: true,
  })
  check('практический шаг добавлен', practiceStep.ok)

  const hrStep = await addProgramStep(actor, program.programId, {
    type: 'DOCUMENT',
    refId: contract.id,
    required: true,
  })
  check('HR-документ в программу не включается', !hrStep.ok && hrStep.error === 'notFound')

  const untitled = await addProgramStep(actor, program.programId, {
    type: 'PRACTICE',
    title: '   ',
    required: true,
  })
  check('практика без названия не добавляется', !untitled.ok && untitled.error === 'titleRequired')

  if (!documentStep.ok || !practiceStep.ok) return finish()

  const self = await enrollInProgram(actor, { programId: program.programId, userId: actor.id })
  check('записать себя или старшего нельзя', !self.ok && self.error === 'participantTooHigh')

  const sameMentor = await enrollInProgram(actor, {
    programId: program.programId,
    userId: employee.id,
    mentorId: employee.id,
  })
  check('участник не может быть своим куратором', !sameMentor.ok && sameMentor.error === 'mentorIsParticipant')

  const enrollment = await enrollInProgram(actor, {
    programId: program.programId,
    userId: employee.id,
    mentorId: actor.id,
  })
  check('сотрудник записан, куратор назначен', enrollment.ok)
  if (!enrollment.ok) return finish()

  const duplicate = await enrollInProgram(actor, { programId: program.programId, userId: employee.id })
  check('повторная запись запрещена', !duplicate.ok && duplicate.error === 'alreadyEnrolled')

  const initial = await getEnrollment(actor, enrollment.enrollmentId)
  const stepDone = (type: string) => Boolean(initial?.steps.find((step) => step.type === type)?.done)
  check('шаг-тест засчитан по уже сданному бумажному тесту', stepDone('TEST'))
  check('шаг-документ не засчитан до подтверждения', !stepDone('DOCUMENT'))
  check('прогресс 1 из 3', initial?.progress.requiredDone === 1 && initial.progress.requiredTotal === 3)

  const early = await completeEnrollment(actor, enrollment.enrollmentId)
  check('без всех шагов сертификат не выдаётся', !early.ok && early.error === 'notReady')

  const foreignView = await getEnrollment(
    { ...employee, id: admin.id === employee.id ? 'nobody' : employee.id },
    enrollment.enrollmentId,
  )
  check('участник видит свою программу', foreignView !== null && foreignView.isParticipant)

  const acknowledged = await acknowledgeStepDocument(
    employee,
    enrollment.enrollmentId,
    documentStep.stepId,
  )
  check('участник подтвердил прочтение со страницы программы', acknowledged.ok)

  const selfVerify = await setPracticeStep(employee, {
    enrollmentId: enrollment.enrollmentId,
    stepId: practiceStep.stepId,
    done: true,
  })
  check('свою практику участник не подтверждает', !selfVerify.ok && selfVerify.error === 'cannotVerifyOwn')

  const notPractice = await setPracticeStep(actor, {
    enrollmentId: enrollment.enrollmentId,
    stepId: documentStep.stepId,
    done: true,
  })
  check('вручную отмечается только практика', !notPractice.ok && notPractice.error === 'notPracticeStep')

  const verified = await setPracticeStep(actor, {
    enrollmentId: enrollment.enrollmentId,
    stepId: practiceStep.stepId,
    done: true,
  })
  check('куратор подтвердил практику', verified.ok)

  const ready = await getEnrollment(actor, enrollment.enrollmentId)
  check(
    'все обязательные шаги пройдены',
    ready?.progress.ready === true,
    `${ready?.progress.requiredDone}/${ready?.progress.requiredTotal}`,
  )

  const ownCertificate = await completeEnrollment(employee, enrollment.enrollmentId)
  check('без права выдачи сертификат не выдать', !ownCertificate.ok && ownCertificate.error === 'forbidden')

  const issued = await completeEnrollment(actor, enrollment.enrollmentId)
  check('сертификат выдан', issued.ok, issued.ok ? issued.number : issued.error)
  if (!issued.ok) return finish()

  check('номер в формате КОД-ГОД-NNNN', /^[A-Z0-9-]+-\d{4}-\d{4}$/.test(issued.number), issued.number)

  const stored = await db.certificate.findUniqueOrThrow({
    where: { id: issued.certificateId },
    select: { fileKey: true },
  })
  check('PDF сохранён в хранилище', Boolean(stored.fileKey))

  const download = await getCertificateDownload(employee, issued.certificateId)
  const response = download ? await fetch(download.url) : null
  const bytes = response?.ok ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array()
  const header = String.fromCharCode(...bytes.slice(0, 5))
  check('владелец скачивает PDF по временной ссылке', header === '%PDF-', `${bytes.length} байт`)
  if (process.env.SMOKE_PDF_OUT && bytes.length > 0) {
    await writeFile(process.env.SMOKE_PDF_OUT, bytes)
    console.log(`        PDF сохранён: ${process.env.SMOKE_PDF_OUT}`)
  }

  const again = await completeEnrollment(actor, enrollment.enrollmentId)
  check('повторная выдача невозможна', !again.ok && again.error === 'alreadyCompleted')

  const frozen = await setPracticeStep(actor, {
    enrollmentId: enrollment.enrollmentId,
    stepId: practiceStep.stepId,
    done: false,
  })
  check('после выдачи прогресс заморожен', !frozen.ok && frozen.error === 'enrollmentCompleted')

  const found = await listCertificates(actor, issued.number)
  check('сертификат находится в реестре по номеру', found.length === 1 && found[0]?.number === issued.number)

  return finish()
}

async function finish() {
  console.log('\n' + '═'.repeat(78))
  if (failures > 0) {
    console.error(`Провалено проверок: ${failures}`)
    process.exitCode = 1
  } else {
    console.log('Все проверки пройдены.')
  }
  await db.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  process.exitCode = 1
  await db.$disconnect()
})
