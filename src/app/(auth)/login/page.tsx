import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/server/auth/session'
import { LoginForm } from './login-form'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  // Уже вошедшего незачем держать на форме входа
  if (await getCurrentUser()) redirect('/dashboard')

  // В Next 16 searchParams — промис
  const params = await searchParams
  const from = typeof params.from === 'string' ? params.from : ''

  const t = await getTranslations('auth.signIn')

  return (
    <>
      <h1 className="text-xl font-semibold text-text">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-text-muted">{t('subtitle')}</p>
      <LoginForm from={from} />
    </>
  )
}
