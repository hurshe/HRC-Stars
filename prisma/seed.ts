// Сид базовых справочников HRC STARS.
// Идемпотентен: можно запускать повторно, существующие записи обновятся, а не задублируются.
// Запуск: npm run db:seed
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { PERMISSIONS, ROLES, DEFAULT_ROLE_PERMISSIONS } from '../src/lib/permissions'

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ─── Департаменты ─────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { code: 'MANAGEMENT', nameEn: 'Management', namePl: 'Zarząd', sortOrder: 10 },
  { code: 'FOH', nameEn: 'Front of House', namePl: 'Sala', sortOrder: 20 },
  { code: 'KITCHEN', nameEn: 'Kitchen', namePl: 'Kuchnia', sortOrder: 30 },
  { code: 'RETAIL', nameEn: 'Retail', namePl: 'Sklep', sortOrder: 40 },
  { code: 'RECEIVING', nameEn: 'Receiving', namePl: 'Magazyn', sortOrder: 50 },
] as const

// ─── Позиции ──────────────────────────────────────────────────────────────────

const POSITIONS = [
  { code: 'GM', nameEn: 'General Manager', namePl: 'Dyrektor generalny', department: 'MANAGEMENT', sortOrder: 10 },
  { code: 'AGM', nameEn: 'Assistant General Manager', namePl: 'Zastępca dyrektora', department: 'MANAGEMENT', sortOrder: 20 },
  { code: 'MANAGER', nameEn: 'Manager', namePl: 'Menedżer', department: 'MANAGEMENT', sortOrder: 30 },
  { code: 'SUPERVISOR', nameEn: 'Supervisor', namePl: 'Kierownik zmiany', department: 'MANAGEMENT', sortOrder: 40 },

  { code: 'SERVER', nameEn: 'Server', namePl: 'Kelner', department: 'FOH', sortOrder: 10 },
  { code: 'BARTENDER', nameEn: 'Bartender', namePl: 'Barman', department: 'FOH', sortOrder: 20 },
  { code: 'BARBACK', nameEn: 'Barback', namePl: 'Pomocnik barmana', department: 'FOH', sortOrder: 30 },
  { code: 'HOST', nameEn: 'Host', namePl: 'Host', department: 'FOH', sortOrder: 40 },
  { code: 'BUSSER', nameEn: 'Busser', namePl: 'Pomocnik kelnera', department: 'FOH', sortOrder: 50 },

  { code: 'KITCHEN_MANAGER', nameEn: 'Kitchen Manager', namePl: 'Kierownik kuchni', department: 'KITCHEN', sortOrder: 10 },
  { code: 'KITCHEN_SUPERVISOR', nameEn: 'Kitchen Supervisor', namePl: 'Zastępca kierownika kuchni', department: 'KITCHEN', sortOrder: 20 },
  { code: 'COOK', nameEn: 'Cook', namePl: 'Kucharz', department: 'KITCHEN', sortOrder: 30 },
  { code: 'DISH', nameEn: 'Dishwasher', namePl: 'Pomoc kuchenna', department: 'KITCHEN', sortOrder: 40 },

  { code: 'RSA', nameEn: 'Retail Sales Assistant', namePl: 'Sprzedawca w sklepie', department: 'RETAIL', sortOrder: 10 },

  { code: 'RECEIVING', nameEn: 'Receiving', namePl: 'Magazynier', department: 'RECEIVING', sortOrder: 10 },
] as const

// ─── Настройки по умолчанию ───────────────────────────────────────────────────

const SETTINGS: { key: string; value: unknown }[] = [
  // Проходной балл по умолчанию, %. Переопределяется на конкретном тесте
  { key: 'test.default_pass_threshold', value: 80 },
  // Границы цветовых зон в матрице обучения, %
  { key: 'test.color_bands', value: { danger: 60, warning: 80 } },
  // Срок жизни Wild Card, дней (3 месяца)
  { key: 'wildcard.ttl_days', value: 90 },
  // За сколько дней предупреждать о сгорании карт
  { key: 'wildcard.expiry_warning_days', value: 14 },
  // Лимит выдачи Wild Card на человека в месяц. null = без лимита
  { key: 'wildcard.monthly_grant_limit', value: null },
  // Срок жизни приглашения по ссылке, дней
  { key: 'invitation.link_ttl_days', value: 7 },
  // Срок жизни кода активации, часов
  { key: 'invitation.code_ttl_hours', value: 24 },
]

// ─── Обязательные документы сотрудника ────────────────────────────────────
//
// Взято из правой части листа SERVER TEST SCORES: именно эти колонки
// менеджер сейчас закрашивает вручную.

const DOCUMENT_REQUIREMENTS = [
  { code: 'CV', nameEn: 'CV', namePl: 'CV', sortOrder: 10 },
  { code: 'INTERVIEW', nameEn: 'Interview I & II', namePl: 'Rozmowa I i II', sortOrder: 20 },
  { code: 'JOB_DESCRIPTION', nameEn: 'Job Description', namePl: 'Opis stanowiska', sortOrder: 30 },
  { code: 'LEARNING_TECH_POLICY', nameEn: 'Learning Technology Policy', namePl: 'Polityka technologii szkoleniowych', sortOrder: 40 },
  { code: 'BSP_VISUAL', nameEn: 'BSP Visual Validation', namePl: 'BSP Visual Validation', sortOrder: 50 },
  { code: 'BSP_LAST_PAGE', nameEn: 'BSP Last Page', namePl: 'BSP Last Page', sortOrder: 60 },
  { code: 'EMPLOYEE_HANDBOOK', nameEn: 'Employee Handbook', namePl: 'Regulamin pracownika', sortOrder: 70 },
  { code: 'ORIENTATION_SIGN_OFF', nameEn: 'Orientation Sign Off Sheet', namePl: 'Potwierdzenie orientacji', sortOrder: 80 },
  { code: 'REX_FORM', nameEn: 'REX form', namePl: 'Formularz REX', sortOrder: 90, validityDays: 365 },
  { code: 'MEDICAL', nameEn: 'Medical certificate', namePl: 'Badania lekarskie', sortOrder: 100, validityDays: 365 },
] as const

// ─── Каталог ваучеров ─────────────────────────────────────────────────────

const VOUCHER_TYPES = [
  { name: 'Lunch', description: 'Lunch na zmianie', cost: 3, sortOrder: 10 },
  { name: 'Breakfast', description: 'Śniadanie na zmianie', cost: 2, sortOrder: 20 },
  { name: '50% off food', description: '50% zniżki na jedzenie', cost: 5, validityDays: 30, sortOrder: 30 },
  { name: '25% off Rock Shop', description: '25% zniżki w sklepie', cost: 4, validityDays: 30, sortOrder: 40 },
] as const

// ─── Запуск ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Сид HRC STARS\n')

  for (const d of DEPARTMENTS) {
    await db.department.upsert({
      where: { code: d.code },
      update: { nameEn: d.nameEn, namePl: d.namePl, sortOrder: d.sortOrder },
      create: d,
    })
  }
  console.log(`  департаменты: ${DEPARTMENTS.length}`)

  const departmentsByCode = new Map((await db.department.findMany()).map((d) => [d.code, d.id]))
  for (const p of POSITIONS) {
    const departmentId = departmentsByCode.get(p.department)
    if (!departmentId) throw new Error(`Департамент ${p.department} не найден`)
    const data = { nameEn: p.nameEn, namePl: p.namePl, departmentId, sortOrder: p.sortOrder }
    await db.position.upsert({
      where: { code: p.code },
      update: data,
      create: { code: p.code, ...data },
    })
  }
  console.log(`  позиции: ${POSITIONS.length}`)

  for (const r of ROLES) {
    await db.role.upsert({
      where: { code: r.code },
      update: { nameEn: r.nameEn, namePl: r.namePl, level: r.level, isSystem: true },
      create: { ...r, isSystem: true },
    })
  }
  console.log(`  роли: ${ROLES.length}`)

  for (const [index, p] of PERMISSIONS.entries()) {
    const data = {
      group: p.group,
      nameEn: p.nameEn,
      namePl: p.namePl,
      isSensitive: 'isSensitive' in p ? p.isSensitive : false,
      isEditable: 'isEditable' in p ? p.isEditable : true,
      sortOrder: index,
    }
    await db.permission.upsert({
      where: { code: p.code },
      update: data,
      create: { code: p.code, ...data },
    })
  }
  console.log(`  права: ${PERMISSIONS.length}`)

  // Существующие связи не трогаем: если GM уже поменял права в интерфейсе,
  // повторный сид не должен откатывать его настройку.
  const rolesByCode = new Map((await db.role.findMany()).map((r) => [r.code, r.id]))
  const permissionsByCode = new Map((await db.permission.findMany()).map((p) => [p.code, p.id]))

  let created = 0
  for (const [roleCode, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = rolesByCode.get(roleCode)
    if (!roleId) throw new Error(`Роль ${roleCode} не найдена`)
    for (const code of codes) {
      const permissionId = permissionsByCode.get(code)
      if (!permissionId) throw new Error(`Право ${code} не найдено`)
      const existing = await db.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId, permissionId } },
      })
      if (!existing) {
        await db.rolePermission.create({ data: { roleId, permissionId, enabled: true } })
        created++
      }
    }
  }
  console.log(`  связей роль-право создано: ${created}`)

  // Локация. Название заведомо временное — заказчик переименует в интерфейсе.
  const location = await db.location.upsert({
    where: { code: 'HRC-01' },
    update: {},
    create: {
      code: 'HRC-01',
      name: 'Hard Rock Cafe',
      timezone: 'Europe/Warsaw',
      defaultLocale: 'pl',
    },
  })
  console.log(`  локация: ${location.name} (${location.code})`)

  // Уже изменённые значения настроек не перезаписываем
  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: { scope_key: { scope: 'GLOBAL', key: s.key } },
      update: {},
      create: { scope: 'GLOBAL', key: s.key, value: s.value as never },
    })
  }
  console.log(`  настройки: ${SETTINGS.length}`)

  for (const requirement of DOCUMENT_REQUIREMENTS) {
    const data = {
      nameEn: requirement.nameEn,
      namePl: requirement.namePl,
      sortOrder: requirement.sortOrder,
      validityDays: 'validityDays' in requirement ? requirement.validityDays : null,
    }
    await db.documentRequirement.upsert({
      where: { locationId_code: { locationId: location.id, code: requirement.code } },
      update: data,
      create: { locationId: location.id, code: requirement.code, ...data },
    })
  }
  console.log(`  обязательные документы: ${DOCUMENT_REQUIREMENTS.length}`)

  // Каталог ваучеров создаётся один раз: дальше его ведёт менеджер,
  // и повторный сид не должен затирать его правки
  for (const voucher of VOUCHER_TYPES) {
    const existing = await db.voucherType.findFirst({
      where: { locationId: location.id, name: voucher.name },
      select: { id: true },
    })
    if (!existing) {
      await db.voucherType.create({
        data: {
          locationId: location.id,
          name: voucher.name,
          description: voucher.description,
          cost: voucher.cost,
          validityDays: 'validityDays' in voucher ? voucher.validityDays : null,
          sortOrder: voucher.sortOrder,
        },
      })
    }
  }
  console.log(`  ваучеры: ${VOUCHER_TYPES.length}`)

  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    console.log('\n  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD не заданы — администратор не создан')
  } else {
    const superAdminRoleId = rolesByCode.get('SUPER_ADMIN')!
    const admin = await db.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        firstName: 'System',
        lastName: 'Administrator',
        passwordHash: await hash(adminPassword, 12),
        status: 'ACTIVE',
        locale: 'pl',
        mustChangePassword: true,
        roleId: superAdminRoleId,
        locationId: location.id,
        emailVerifiedAt: new Date(),
      },
    })
    console.log(`  администратор: ${admin.email} (смена пароля при первом входе)`)
  }

  console.log('\nГотово.')
}

main()
  .catch((e) => {
    console.error('Сид упал:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
