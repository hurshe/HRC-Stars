import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/server/auth/session'
import { ChangePasswordForm } from './change-password-form'

export default async function ChangePasswordPage() {
  await requireUser()
  const t = await getTranslations('auth.changePassword')

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
      <ChangePasswordForm />
    </>
  )
}
