// Сид базовых справочников HRC STARS.
// Идемпотентен: можно запускать повторно, существующие записи обновятся, а не задублируются.
// Запуск: npm run db:seed
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'

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

// ─── Роли ─────────────────────────────────────────────────────────────────────

const ROLES = [
  { code: 'SUPER_ADMIN', nameEn: 'System Administrator', namePl: 'Administrator systemu', level: 100 },
  { code: 'GM', nameEn: 'General Manager', namePl: 'Dyrektor generalny', level: 90 },
  { code: 'AGM', nameEn: 'Assistant General Manager', namePl: 'Zastępca dyrektora', level: 80 },
  { code: 'MANAGER', nameEn: 'Manager', namePl: 'Menedżer', level: 70 },
  { code: 'SUPERVISOR', nameEn: 'Supervisor', namePl: 'Kierownik zmiany', level: 60 },
  { code: 'MIT', nameEn: 'Manager in Training', namePl: 'Manager in Training', level: 40 },
  { code: 'STAFF', nameEn: 'Staff', namePl: 'Pracownik', level: 10 },
] as const

// ─── Права ────────────────────────────────────────────────────────────────────
//
// Важно: все коды описывают действия НАД ДРУГИМИ людьми и общими данными.
// Доступ к собственному профилю, своим тестам, своим чек-листам и своему балансу
// Wild Card правами не регулируется — он есть у любого активного сотрудника всегда.
//
// isSensitive — GDPR-чувствительное право: включение показывает предупреждение
//               и попадает в отдельный отчёт.
// isEditable=false — право уровня SUPER_ADMIN, из интерфейса не редактируется вообще.

type PermissionSeed = {
  code: string
  group: string
  nameEn: string
  namePl: string
  isSensitive?: boolean
  isEditable?: boolean
}

const PERMISSIONS: PermissionSeed[] = [
  // Сотрудники
  { code: 'employee.view', group: 'employees', nameEn: 'View employees', namePl: 'Podgląd pracowników' },
  { code: 'employee.create', group: 'employees', nameEn: 'Create employees', namePl: 'Tworzenie pracowników' },
  { code: 'employee.edit', group: 'employees', nameEn: 'Edit employees', namePl: 'Edycja pracowników' },
  { code: 'employee.archive', group: 'employees', nameEn: 'Archive employees', namePl: 'Archiwizacja pracowników' },
  { code: 'employee.invite', group: 'employees', nameEn: 'Send invitations', namePl: 'Wysyłanie zaproszeń' },
  { code: 'employee.position.manage', group: 'employees', nameEn: 'Manage positions', namePl: 'Zarządzanie stanowiskami' },
  { code: 'employee.trainer.manage', group: 'employees', nameEn: 'Assign trainer badge', namePl: 'Nadawanie oznaczenia trenera' },

  // Персональные данные (GDPR)
  { code: 'personal_data.view', group: 'personal_data', nameEn: 'View personal data', namePl: 'Podgląd danych osobowych', isSensitive: true },
  { code: 'personal_data.edit', group: 'personal_data', nameEn: 'Edit personal data', namePl: 'Edycja danych osobowych', isSensitive: true },
  { code: 'personal_data.export', group: 'personal_data', nameEn: 'Export personal data', namePl: 'Eksport danych osobowych', isSensitive: true },
  { code: 'personal_data.erase', group: 'personal_data', nameEn: 'Erase personal data (GDPR)', namePl: 'Usunięcie danych osobowych (RODO)', isSensitive: true, isEditable: false },

  // Документы
  { code: 'document.view', group: 'documents', nameEn: 'View documents', namePl: 'Podgląd dokumentów' },
  { code: 'document.create', group: 'documents', nameEn: 'Create documents', namePl: 'Tworzenie dokumentów' },
  { code: 'document.edit', group: 'documents', nameEn: 'Edit documents', namePl: 'Edycja dokumentów' },
  { code: 'document.delete', group: 'documents', nameEn: 'Delete documents', namePl: 'Usuwanie dokumentów' },
  { code: 'document.assign', group: 'documents', nameEn: 'Assign documents', namePl: 'Przypisywanie dokumentów' },
  { code: 'document.requirement.manage', group: 'documents', nameEn: 'Manage required documents', namePl: 'Zarządzanie wymaganymi dokumentami' },

  // Тесты
  { code: 'test.view', group: 'tests', nameEn: 'View tests', namePl: 'Podgląd testów' },
  { code: 'test.create', group: 'tests', nameEn: 'Create tests', namePl: 'Tworzenie testów' },
  { code: 'test.edit', group: 'tests', nameEn: 'Edit tests', namePl: 'Edycja testów' },
  { code: 'test.delete', group: 'tests', nameEn: 'Delete tests', namePl: 'Usuwanie testów' },
  { code: 'test.assign', group: 'tests', nameEn: 'Assign tests', namePl: 'Przypisywanie testów' },
  { code: 'test.result.view', group: 'tests', nameEn: 'View results of others', namePl: 'Podgląd wyników innych' },
  { code: 'test.result.enter', group: 'tests', nameEn: 'Enter paper results', namePl: 'Wprowadzanie wyników papierowych' },
  { code: 'test.threshold.manage', group: 'tests', nameEn: 'Manage pass thresholds', namePl: 'Zarządzanie progami zaliczenia' },

  // Чек-листы
  { code: 'checklist.view', group: 'checklists', nameEn: 'View checklists', namePl: 'Podgląd list kontrolnych' },
  { code: 'checklist.template.manage', group: 'checklists', nameEn: 'Manage templates', namePl: 'Zarządzanie szablonami' },
  { code: 'checklist.run', group: 'checklists', nameEn: 'Complete checklists', namePl: 'Wypełnianie list kontrolnych' },
  { code: 'checklist.verify', group: 'checklists', nameEn: 'Verify checklists', namePl: 'Weryfikacja list kontrolnych' },

  // Задачи
  { code: 'task.view', group: 'tasks', nameEn: 'View tasks', namePl: 'Podgląd zadań' },
  { code: 'task.create', group: 'tasks', nameEn: 'Create tasks', namePl: 'Tworzenie zadań' },
  { code: 'task.assign', group: 'tasks', nameEn: 'Assign tasks', namePl: 'Przydzielanie zadań' },
  { code: 'task.verify', group: 'tasks', nameEn: 'Accept completed tasks', namePl: 'Akceptacja wykonanych zadań' },

  // Wild Cards
  { code: 'wildcard.grant', group: 'wildcards', nameEn: 'Grant Wild Cards', namePl: 'Przyznawanie Wild Card' },
  { code: 'wildcard.balance.view', group: 'wildcards', nameEn: 'View balances of others', namePl: 'Podgląd sald innych' },
  { code: 'wildcard.voucher.manage', group: 'wildcards', nameEn: 'Manage voucher catalogue', namePl: 'Zarządzanie katalogiem voucherów' },
  { code: 'wildcard.request.approve', group: 'wildcards', nameEn: 'Approve voucher requests', namePl: 'Zatwierdzanie wniosków o voucher' },
  { code: 'wildcard.report.view', group: 'wildcards', nameEn: 'View granting report', namePl: 'Raport przyznanych Wild Card' },

  // Отчёты
  { code: 'report.view', group: 'reports', nameEn: 'View reports', namePl: 'Podgląd raportów' },
  { code: 'report.export', group: 'reports', nameEn: 'Export reports', namePl: 'Eksport raportów' },

  // Настройки и аудит
  { code: 'settings.view', group: 'settings', nameEn: 'View settings', namePl: 'Podgląd ustawień' },
  { code: 'settings.edit', group: 'settings', nameEn: 'Edit settings', namePl: 'Edycja ustawień' },
  { code: 'settings.permissions.manage', group: 'settings', nameEn: 'Manage role permissions', namePl: 'Zarządzanie uprawnieniami ról' },
  { code: 'settings.location.manage', group: 'settings', nameEn: 'Manage locations', namePl: 'Zarządzanie lokalizacjami', isEditable: false },
  { code: 'settings.role.manage', group: 'settings', nameEn: 'Manage roles', namePl: 'Zarządzanie rolami', isEditable: false },
  { code: 'audit.view', group: 'settings', nameEn: 'View audit log', namePl: 'Podgląd dziennika audytu' },
  { code: 'audit.gdpr.view', group: 'settings', nameEn: 'View GDPR report', namePl: 'Podgląd raportu RODO', isSensitive: true },
]

// ─── Наборы прав по ролям ─────────────────────────────────────────────────────
//
// SUPERVISOR намеренно совпадает с MANAGER один в один: по требованию заказчика
// супервайзер умеет всё то же самое, отличие только в уровне иерархии.

const ALL = PERMISSIONS.map((p) => p.code)
const SUPER_ADMIN_ONLY = PERMISSIONS.filter((p) => p.isEditable === false).map((p) => p.code)

const MANAGER_PERMISSIONS = [
  'employee.view', 'employee.create', 'employee.edit', 'employee.archive',
  'employee.invite', 'employee.position.manage', 'employee.trainer.manage',
  'personal_data.view', 'personal_data.edit', 'personal_data.export',
  'document.view', 'document.create', 'document.edit', 'document.delete',
  'document.assign', 'document.requirement.manage',
  'test.view', 'test.create', 'test.edit', 'test.delete', 'test.assign',
  'test.result.view', 'test.result.enter', 'test.threshold.manage',
  'checklist.view', 'checklist.template.manage', 'checklist.run', 'checklist.verify',
  'task.view', 'task.create', 'task.assign', 'task.verify',
  'wildcard.grant', 'wildcard.balance.view', 'wildcard.voucher.manage',
  'wildcard.request.approve',
  'report.view', 'report.export',
  'settings.view', 'audit.view',
]

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL,
  // GM и AGM получают всё, кроме прав уровня администратора системы
  GM: ALL.filter((c) => !SUPER_ADMIN_ONLY.includes(c)),
  AGM: ALL.filter((c) => !SUPER_ADMIN_ONLY.includes(c)),
  MANAGER: MANAGER_PERMISSIONS,
  SUPERVISOR: MANAGER_PERMISSIONS,
  // Гость на обучении: только материалы и свои тесты
  MIT: ['document.view', 'test.view'],
  STAFF: ['document.view', 'checklist.run', 'task.view'],
}

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

// ─── Запуск ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Сид HRC STARS\n')

  // Департаменты
  for (const d of DEPARTMENTS) {
    await db.department.upsert({
      where: { code: d.code },
      update: { nameEn: d.nameEn, namePl: d.namePl, sortOrder: d.sortOrder },
      create: d,
    })
  }
  console.log(`  департаменты: ${DEPARTMENTS.length}`)

  // Позиции
  const departmentsByCode = new Map(
    (await db.department.findMany()).map((d) => [d.code, d.id]),
  )
  for (const p of POSITIONS) {
    const departmentId = departmentsByCode.get(p.department)
    if (!departmentId) throw new Error(`Департамент ${p.department} не найден`)
    await db.position.upsert({
      where: { code: p.code },
      update: { nameEn: p.nameEn, namePl: p.namePl, departmentId, sortOrder: p.sortOrder },
      create: { code: p.code, nameEn: p.nameEn, namePl: p.namePl, departmentId, sortOrder: p.sortOrder },
    })
  }
  console.log(`  позиции: ${POSITIONS.length}`)

  // Роли
  for (const r of ROLES) {
    await db.role.upsert({
      where: { code: r.code },
      update: { nameEn: r.nameEn, namePl: r.namePl, level: r.level, isSystem: true },
      create: { ...r, isSystem: true },
    })
  }
  console.log(`  роли: ${ROLES.length}`)

  // Права
  for (const [index, p] of PERMISSIONS.entries()) {
    await db.permission.upsert({
      where: { code: p.code },
      update: {
        group: p.group,
        nameEn: p.nameEn,
        namePl: p.namePl,
        isSensitive: p.isSensitive ?? false,
        isEditable: p.isEditable ?? true,
        sortOrder: index,
      },
      create: {
        code: p.code,
        group: p.group,
        nameEn: p.nameEn,
        namePl: p.namePl,
        isSensitive: p.isSensitive ?? false,
        isEditable: p.isEditable ?? true,
        sortOrder: index,
      },
    })
  }
  console.log(`  права: ${PERMISSIONS.length}`)

  // Наборы прав по ролям.
  // Существующие связи не трогаем: если GM уже поменял права в интерфейсе,
  // повторный сид не должен откатывать его настройку.
  const rolesByCode = new Map((await db.role.findMany()).map((r) => [r.code, r.id]))
  const permissionsByCode = new Map((await db.permission.findMany()).map((p) => [p.code, p.id]))

  let created = 0
  for (const [roleCode, codes] of Object.entries(ROLE_PERMISSIONS)) {
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

  // Настройки по умолчанию. Уже изменённые значения не перезаписываем.
  for (const s of SETTINGS) {
    await db.setting.upsert({
      where: { scope_key: { scope: 'GLOBAL', key: s.key } },
      update: {},
      create: { scope: 'GLOBAL', key: s.key, value: s.value as never },
    })
  }
  console.log(`  настройки: ${SETTINGS.length}`)

  // Первый администратор
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
