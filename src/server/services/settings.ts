import { cache } from 'react'
import { db } from '@/lib/db'
import { writeAudit } from './audit'
import type { CurrentUser } from '@/server/auth/session'

/*
  Настройки, которые меняются из интерфейса, а не в коде: проходные баллы,
  срок жизни Wild Card, лимиты выдачи, сроки приглашений.

  Значение по локации перекрывает глобальное. Так сеть кафе сможет иметь
  общие правила с локальными исключениями, не заводя копию настроек
  для каждой точки.
*/

export const getSetting = cache(async <T>(key: string, locationId?: string): Promise<T | null> => {
  if (locationId) {
    const local = await db.setting.findUnique({
      where: { scope_key: { scope: locationId, key } },
      select: { value: true },
    })
    if (local && local.value !== null) return local.value as T
  }

  const global = await db.setting.findUnique({
    where: { scope_key: { scope: 'GLOBAL', key } },
    select: { value: true },
  })

  return global ? (global.value as T) : null
})

export async function getSettingNumber(
  key: string,
  fallback: number,
  locationId?: string,
): Promise<number> {
  const value = await getSetting<unknown>(key, locationId)
  return typeof value === 'number' ? value : fallback
}

export async function setSetting(
  actor: CurrentUser,
  key: string,
  value: unknown,
  scope: 'GLOBAL' | 'LOCATION' = 'GLOBAL',
) {
  const resolvedScope = scope === 'LOCATION' ? actor.locationId : 'GLOBAL'

  const before = await db.setting.findUnique({
    where: { scope_key: { scope: resolvedScope, key } },
    select: { value: true },
  })

  await db.setting.upsert({
    where: { scope_key: { scope: resolvedScope, key } },
    update: { value: value as never, updatedById: actor.id },
    create: {
      scope: resolvedScope,
      key,
      value: value as never,
      locationId: scope === 'LOCATION' ? actor.locationId : null,
      updatedById: actor.id,
    },
  })

  await writeAudit({
    actorId: actor.id,
    action: 'setting.changed',
    entityType: 'Setting',
    entityId: `${resolvedScope}:${key}`,
    locationId: actor.locationId,
    before: { value: (before?.value ?? null) as never },
    after: { value: value as never },
  })
}
