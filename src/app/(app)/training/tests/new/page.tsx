import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requirePermission } from '@/server/auth/session'
import { NewTestForm } from './new-test-form'

export default async function NewTestPage() {
  await requirePermission('test.create')
  const t = await getTranslations('training.new')
  const tTraining = await getTranslations('training')

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/training"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tTraining('title')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <NewTestForm />
    </div>
  )
}
