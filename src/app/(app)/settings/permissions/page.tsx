import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requirePermission } from '@/server/auth/session'
import { getPermissionMatrix } from '@/server/services/permissions-admin'
import { PermissionMatrix } from './permission-matrix'

export default async function PermissionsPage() {
  const actor = await requirePermission('settings.permissions.manage')
  const locale = await getLocale()
  const t = await getTranslations('settings')

  const matrix = await getPermissionMatrix(actor)

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('title')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">
          {t('permissions.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
      </div>

      <PermissionMatrix
        roles={matrix.roles}
        groups={matrix.groups}
        // Set не сериализуется через границу сервер-клиент, передаём массивом
        enabledKeys={[...matrix.enabled]}
        locale={locale}
      />
    </div>
  )
}
