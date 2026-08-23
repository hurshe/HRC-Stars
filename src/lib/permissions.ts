// Каталог прав HRC STARS — единственный источник правды.
// Отсюда читает и сид базы (prisma/seed.ts), и сервисный слой.
//
// Важно: все коды описывают действия НАД ДРУГИМИ людьми и общими данными.
// Доступ к собственному профилю, своим тестам, своим чек-листам и своему балансу
// Wild Card правами не регулируется — он есть у любого активного сотрудника всегда.

export type PermissionDefinition = {
  code: string
  group: PermissionGroup
  nameEn: string
  namePl: string
  /// GDPR-чувствительное: включение показывает предупреждение и идёт в отдельный отчёт
  isSensitive?: boolean
  /// false — право уровня SUPER_ADMIN, из интерфейса не редактируется вообще
  isEditable?: boolean
}

export type PermissionGroup =
  | 'employees'
  | 'personal_data'
  | 'documents'
  | 'tests'
  | 'checklists'
  | 'tasks'
  | 'wildcards'
  | 'reports'
  | 'settings'

export const PERMISSIONS = [
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
  { code: 'wildcard.allocate', group: 'wildcards', nameEn: 'Allocate cards to managers', namePl: 'Wydawanie kart menedżerom' },
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
] as const satisfies readonly PermissionDefinition[]

/// Union всех кодов прав — опечатка в коде права ловится компилятором
export type PermissionCode = (typeof PERMISSIONS)[number]['code']

export const ALL_PERMISSION_CODES = PERMISSIONS.map((p) => p.code) as PermissionCode[]

export const SUPER_ADMIN_ONLY_CODES = PERMISSIONS.filter(
  (p) => 'isEditable' in p && p.isEditable === false,
).map((p) => p.code) as PermissionCode[]

// ─── Роли ─────────────────────────────────────────────────────────────────────

export const ROLES = [
  { code: 'SUPER_ADMIN', nameEn: 'System Administrator', namePl: 'Administrator systemu', level: 100 },
  { code: 'GM', nameEn: 'General Manager', namePl: 'Dyrektor generalny', level: 90 },
  { code: 'AGM', nameEn: 'Assistant General Manager', namePl: 'Zastępca dyrektora', level: 80 },
  { code: 'MANAGER', nameEn: 'Manager', namePl: 'Menedżer', level: 70 },
  { code: 'SUPERVISOR', nameEn: 'Supervisor', namePl: 'Kierownik zmiany', level: 60 },
  { code: 'MIT', nameEn: 'Manager in Training', namePl: 'Manager in Training', level: 40 },
  { code: 'STAFF', nameEn: 'Staff', namePl: 'Pracownik', level: 10 },
] as const

export type RoleCode = (typeof ROLES)[number]['code']

export const ROLE_LEVELS = Object.fromEntries(ROLES.map((r) => [r.code, r.level])) as Record<RoleCode, number>

// ─── Наборы прав по ролям (значения по умолчанию для сида) ────────────────────
//
// SUPERVISOR намеренно совпадает с MANAGER один в один: по требованию заказчика
// супервайзер умеет всё то же самое, отличие только в уровне иерархии.
// После первого сида эти наборы редактируются GM и AGM в интерфейсе,
// повторный запуск сида чужие настройки не откатывает.

const MANAGER_PERMISSIONS: PermissionCode[] = [
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

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: ALL_PERMISSION_CODES,
  // GM и AGM получают всё, кроме прав уровня администратора системы
  GM: ALL_PERMISSION_CODES.filter((c) => !SUPER_ADMIN_ONLY_CODES.includes(c)),
  AGM: ALL_PERMISSION_CODES.filter((c) => !SUPER_ADMIN_ONLY_CODES.includes(c)),
  MANAGER: MANAGER_PERMISSIONS,
  SUPERVISOR: MANAGER_PERMISSIONS,
  // Гость на обучении: только материалы и свои тесты
  MIT: ['document.view', 'test.view'],
  STAFF: ['document.view', 'checklist.run', 'task.view'],
}
