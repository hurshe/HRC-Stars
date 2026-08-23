import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth, PIN_SESSION_MAX_AGE_MS } from '@/auth'
import { db } from '@/lib/db'
import type { PermissionCode } from '@/lib/permissions'
import { ALL_PERMISSION_CODES } from '@/lib/permissions'

export type CurrentUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  locale: string
  isTrainer: boolean
  mustChangePassword: boolean
  role: { code: string; level: number; nameEn: string; namePl: string }
  locationId: string
  locationName: string
  departmentScopeId: string | null
  positions: { code: string; nameEn: string; namePl: string; isPrimary: boolean }[]
  /// Вход был по PIN — доступ к персональным данным и документам ограничен
  viaPin: boolean
}

/// cache() из React делает результат общим на весь запрос: сколько бы серверных
/// компонентов ни спросили текущего пользователя, запрос к базе будет один.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth()
  if (!session?.user?.id) return null

  // PIN-сессия на общем планшете живёт меньше обычной. Проверяем здесь,
  // потому что через эту функцию проходит весь остальной код.
  if (session.viaPin && Date.now() - (session.signedInAt ?? 0) > PIN_SESSION_MAX_AGE_MS) {
    return null
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      locale: true,
      status: true,
      isTrainer: true,
      mustChangePassword: true,
      locationId: true,
      departmentScopeId: true,
      guestUntil: true,
      role: { select: { code: true, level: true, nameEn: true, namePl: true } },
      location: { select: { name: true } },
      positions: {
        where: { endedAt: null },
        select: {
          isPrimary: true,
          position: { select: { code: true, nameEn: true, namePl: true } },
        },
        orderBy: { isPrimary: 'desc' },
      },
    },
  })

  if (!user) return null

  // Статус мог измениться после выдачи токена: уволили, заблокировали,
  // у гостя MIT закончилась стажировка. Сессия должна умирать сразу.
  if (user.status !== 'ACTIVE') return null
  if (user.guestUntil && user.guestUntil < new Date()) return null

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
    positions: user.positions.map((p) => ({ ...p.position, isPrimary: p.isPrimary })),
    viaPin: session.viaPin === true,
  }
})

/// Итоговый набор прав: права роли плюс персональные исключения.
/// Читается из базы на каждый запрос, а не из токена, — иначе изменения,
/// сделанные GM в редакторе прав, применялись бы только после перелогина сотрудника.
export const getPermissions = cache(async (userId: string): Promise<Set<PermissionCode>> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          code: true,
          permissions: {
            where: { enabled: true },
            select: { permission: { select: { code: true } } },
          },
        },
      },
      permissions: {
        select: { enabled: true, permission: { select: { code: true } } },
      },
    },
  })

  if (!user) return new Set()

  // Администратор системы не зависит от содержимого таблицы прав:
  // иначе одной неудачной правкой можно запереть систему без администратора.
  if (user.role.code === 'SUPER_ADMIN') {
    return new Set(ALL_PERMISSION_CODES)
  }

  const codes = new Set<PermissionCode>(
    user.role.permissions.map((rp) => rp.permission.code as PermissionCode),
  )

  // Персональные исключения перекрывают роль в обе стороны
  for (const override of user.permissions) {
    const code = override.permission.code as PermissionCode
    if (override.enabled) codes.add(code)
    else codes.delete(code)
  }

  return codes
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function hasPermission(code: PermissionCode): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const permissions = await getPermissions(user.id)
  return permissions.has(code)
}

/// Проверка права для страницы или Server Action.
/// Вызывать в сервисном слое, а не в компоненте: скрытая кнопка защитой не является.
export async function requirePermission(code: PermissionCode): Promise<CurrentUser> {
  const user = await requireUser()
  const permissions = await getPermissions(user.id)
  if (!permissions.has(code)) redirect('/forbidden')
  return user
}

/// Иерархия: действовать можно только в отношении тех, кто ниже уровнем.
/// На этом же механизме работает постановка задач вниз по цепочке.
export function outranks(actor: CurrentUser, targetRoleLevel: number): boolean {
  return actor.role.level > targetRoleLevel
}
