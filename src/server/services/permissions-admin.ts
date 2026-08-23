import { db } from '@/lib/db'
import { matrixKey, type MatrixGroup, type MatrixRole } from '@/lib/permission-matrix'
import { getPermissions, type CurrentUser } from '@/server/auth/session'
import { writeAudit } from './audit'

export type PermissionMatrix = {
  roles: MatrixRole[]
  groups: MatrixGroup[]
  /// Ключ "roleId:permissionId" → включено ли
  enabled: Set<string>
  actorRoleId: string
}

export async function getPermissionMatrix(actor: CurrentUser): Promise<PermissionMatrix> {
  const [roles, permissions, links] = await Promise.all([
    db.role.findMany({
      orderBy: { level: 'desc' },
      select: { id: true, code: true, level: true, nameEn: true, namePl: true },
    }),
    db.permission.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        group: true,
        nameEn: true,
        namePl: true,
        isSensitive: true,
        isEditable: true,
      },
    }),
    db.rolePermission.findMany({
      where: { enabled: true },
      select: { roleId: true, permissionId: true },
    }),
  ])

  const groups: MatrixGroup[] = []
  for (const permission of permissions) {
    let bucket = groups.find((g) => g.group === permission.group)
    if (!bucket) {
      bucket = { group: permission.group, permissions: [] }
      groups.push(bucket)
    }
    bucket.permissions.push(permission)
  }

  return {
    roles: roles.map((role) => ({ ...role, editable: role.level < actor.role.level })),
    groups,
    enabled: new Set(links.map((link) => matrixKey(link.roleId, link.permissionId))),
    actorRoleId: actor.role.code,
  }
}

export type SetPermissionResult =
  | { ok: true }
  | { ok: false; error: 'notFound' | 'roleTooHigh' | 'permissionLocked' }

/// Без предохранителей редактор прав превращается в дыру: им можно
/// поднять себе полномочия или запереть систему без администратора.
export async function setRolePermission(
  actor: CurrentUser,
  roleId: string,
  permissionId: string,
  enabled: boolean,
): Promise<SetPermissionResult> {
  const [role, permission] = await Promise.all([
    db.role.findUnique({ where: { id: roleId }, select: { id: true, code: true, level: true } }),
    db.permission.findUnique({
      where: { id: permissionId },
      select: { id: true, code: true, isEditable: true, isSensitive: true },
    }),
  ])

  if (!role || !permission) return { ok: false, error: 'notFound' }

  // 1. Строго вниз по иерархии, СВОЮ роль включительно нельзя.
  //    Это закрывает сразу два сценария: выдать полномочия тому, кто выше,
  //    и подкрутить права самому себе. Заодно делает невозможной
  //    самоблокировку — снять с себя право управления правами не выйдет,
  //    потому что своя роль не редактируется в принципе.
  if (role.level >= actor.role.level) return { ok: false, error: 'roleTooHigh' }

  // 2. Права уровня администратора системы из интерфейса не трогаются вообще
  if (!permission.isEditable) return { ok: false, error: 'permissionLocked' }

  // Запереть систему без администратора нельзя и по третьей причине:
  // SUPER_ADMIN получает полный набор прав независимо от таблицы,
  // см. getPermissions() в src/server/auth/session.ts

  const existing = await db.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
    select: { enabled: true },
  })

  await db.rolePermission.upsert({
    where: { roleId_permissionId: { roleId, permissionId } },
    update: { enabled, updatedById: actor.id },
    create: { roleId, permissionId, enabled, updatedById: actor.id },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'permission.changed',
    entityType: 'RolePermission',
    entityId: `${roleId}:${permissionId}`,
    locationId: actor.locationId,
    // Выдача доступа к персональным данным попадает в отдельный GDPR-отчёт
    isSensitive: permission.isSensitive,
    before: { enabled: existing?.enabled ?? false },
    after: { enabled, role: role.code, permission: permission.code },
  })

  return { ok: true }
}

/// Персональные исключения по конкретному человеку — второй слой поверх роли
export async function listUserOverrides(userId: string) {
  return db.userPermission.findMany({
    where: { userId },
    select: {
      enabled: true,
      note: true,
      grantedAt: true,
      permission: { select: { code: true, nameEn: true, namePl: true, isSensitive: true } },
    },
    orderBy: { grantedAt: 'desc' },
  })
}

/// Сколько прав реально получается у роли с учётом всего — для сводки в интерфейсе
export async function countEffectivePermissions(userId: string): Promise<number> {
  return (await getPermissions(userId)).size
}
