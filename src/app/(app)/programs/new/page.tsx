import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requirePermission } from '@/server/auth/session'
import { listPositionOptions } from '@/server/services/programs'
import { NewProgramForm } from './new-program-form'

export default async function NewProgramPage() {
  await requirePermission('program.manage')
  const locale = await getLocale()
  const t = await getTranslations('programs')

  const positions = await listPositionOptions()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/programs/all"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('tabs.all')}
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('new.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('new.subtitle')}</p>
      </div>

      <NewProgramForm positions={positions} locale={locale} />
    </div>
  )
}
