import { z } from 'zod'
import { emailSchema } from './validation'

/// Как передать сотруднику доступ. По почте — обычный путь; кодом —
/// когда доступа к почте прямо сейчас нет и менеджер диктует код лично
export const inviteMethods = ['EMAIL_LINK', 'ACTIVATION_CODE', 'NONE'] as const
export type InviteMethod = (typeof inviteMethods)[number]

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

/// Незаполненный <select> отправляет пустую строку, а не отсутствие значения.
/// Без этого преобразования optional-поле валится на «Invalid option»,
/// хотя пользователь просто ничего не выбрал.
const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === '' || value == null ? undefined : value), z.enum(values).optional())

const withDefault = <const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((value) => (value === '' || value == null ? fallback : value), z.enum(values))

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, { message: 'required' }).max(80),
  lastName: z.string().trim().min(1, { message: 'required' }).max(80),
  email: emailSchema,
  roleId: z.string().min(1, { message: 'required' }),
  /// Хотя бы одна позиция обязательна: от неё зависят обязательные
  /// тесты и документы сотрудника
  positionIds: z.array(z.string().min(1)).min(1, { message: 'required' }),
  primaryPositionId: z.string().optional(),
  employeeNumber: optionalText(40),
  hiredAt: optionalText(10),
  locale: withDefault(['pl', 'en'], 'pl'),
  inviteMethod: withDefault(inviteMethods, 'EMAIL_LINK'),

  // Персональные данные — все необязательные, все шифруются при сохранении
  phone: optionalText(40),
  dateOfBirth: optionalText(10),
  address: optionalText(300),
  personalId: optionalText(40),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(40),
  gender: optionalEnum(['FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED']),
  employmentType: optionalEnum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'STUDENT', 'SEASONAL']),
  notes: optionalText(2000),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const employeeStatuses = [
  'INVITED',
  'ACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'ARCHIVED',
] as const

/// Редактирование не трогает email и способ приглашения: смена адреса —
/// это отдельная операция со своей проверкой, а приглашение уже выдано
export const updateEmployeeSchema = createEmployeeSchema
  .omit({ email: true, inviteMethod: true })
  .extend({
    userId: z.string().min(1),
    status: withDefault(employeeStatuses, 'ACTIVE'),
  })

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export const employeeFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  positionId: z.string().optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>
