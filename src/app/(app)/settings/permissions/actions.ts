'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/server/auth/session'
import { setRolePermission } from '@/server/services/permissions-admin'

export type TogglePermissionResult = { ok: true } | { ok: false; error: string }

export async function togglePermissionAction(
  roleId: string,
  permissionId: string,
  enabled: boolean,
): Promise<TogglePermissionResult> {
  const actor = await requirePermission('settings.permissions.manage')
  const result = await setRolePermission(actor, roleId, permissionId, enabled)

  if (!result.ok) return { ok: false, error: result.error }

  // Права читаются из базы на каждый запрос, поэтому достаточно
  // сбросить кэш страниц — перелогин сотрудникам не нужен
  revalidatePath('/', 'layout')
  return { ok: true }
}
