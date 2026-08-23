import { headers } from 'next/headers'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export type AuditInput = {
  actorId?: string | null
  /// Код действия: employee.created, permission.changed, personal_data.viewed
  action: string
  entityType: string
  entityId?: string | null
  locationId?: string | null
  before?: Prisma.InputJsonValue | null
  after?: Prisma.InputJsonValue | null
  /// Доступ к персональным данным — попадает в отдельный GDPR-отчёт
  isSensitive?: boolean
}

/// Запись в журнал аудита. Никогда не роняет основную операцию:
/// упавший аудит не должен мешать сотруднику работать, но должен быть видён в логах.
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    let ip: string | null = null
    let userAgent: string | null = null

    try {
      const headerList = await headers()
      // За обратным прокси реальный адрес приходит в X-Forwarded-For
      ip =
        headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headerList.get('x-real-ip') ??
        null
      userAgent = headerList.get('user-agent')
    } catch {
      // Вызов вне контекста запроса (фоновая задача) — заголовков просто нет
    }

    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        locationId: input.locationId ?? null,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        isSensitive: input.isSensitive ?? false,
        ip,
        userAgent,
      },
    })
  } catch (error) {
    console.error('[audit] не удалось записать событие', input.action, error)
  }
}
