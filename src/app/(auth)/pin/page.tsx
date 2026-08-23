import { getTranslations } from 'next-intl/server'
import { PinForm } from './pin-form'

export default async function PinPage() {
  const t = await getTranslations('auth.pin')

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
      <PinForm />
    </>
  )
}
