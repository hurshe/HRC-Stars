import { getLocale, getTranslations } from 'next-intl/server'
import { getPermissions, requireUser } from '@/server/auth/session'

export default async function DashboardPage() {
  const user = await requireUser()
  const permissions = await getPermissions(user.id)
  const locale = await getLocale()
  const t = await getTranslations('dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {t('welcome', { name: user.firstName })}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{t('placeholder')}</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-(--radius-panel) border border-border bg-surface p-4">
          <dt className="text-xs tracking-wide text-text-muted uppercase">{t('yourRole')}</dt>
          <dd className="mt-1 font-medium text-text">
            {locale === 'pl' ? user.role.namePl : user.role.nameEn}
          </dd>
        </div>

        <div className="rounded-(--radius-panel) border border-border bg-surface p-4">
          <dt className="text-xs tracking-wide text-text-muted uppercase">{t('yourLocation')}</dt>
          <dd className="mt-1 font-medium text-text">{user.locationName}</dd>
        </div>

        <div className="rounded-(--radius-panel) border border-border bg-surface p-4">
          <dt className="text-xs tracking-wide text-text-muted uppercase">Uprawnienia</dt>
          <dd className="mt-1 font-medium text-text">{permissions.size}</dd>
        </div>
      </dl>
    </div>
  )
}
