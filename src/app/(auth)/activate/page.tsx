import { getTranslations } from 'next-intl/server'
import { checkInvitationToken } from '@/server/services/invitations'
import { FormError } from '@/components/ui/field'
import { ActivateForm } from './activate-form'

export default async function ActivatePage({ searchParams }: PageProps<'/activate'>) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''

  const t = await getTranslations('auth.activate')
  const tError = await getTranslations('auth.errors')

  // Ссылку проверяем до показа формы: незачем предлагать придумать пароль,
  // если приглашение уже просрочено или использовано.
  const check = token ? await checkInvitationToken(token) : null

  if (check && !check.ok) {
    return (
      <>
        <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
        <div className="mt-6">
          <FormError>{tError(check.error)}</FormError>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-text-muted">{t('subtitle')}</p>
      <ActivateForm token={token} knownEmail={check?.ok ? check.email : null} />
    </>
  )
}
