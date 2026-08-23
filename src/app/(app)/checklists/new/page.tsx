import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requirePermission } from '@/server/auth/session'
import { NewTemplateForm } from './new-template-form'

export default async function NewChecklistTemplatePage() {
  const actor = await requirePermission('checklist.template.manage')
  const locale = await getLocale()
  const t = await getTranslations('checklists')

  const positions = await db.position.findMany({
    where: {
      isActive: true,
      ...(actor.departmentScopeId ? { departmentId: actor.departmentScopeId } : {}),
    },
    orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: { id: true, nameEn: true, namePl: true },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/checklists"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('title')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('new.title')}</h1>
      </div>

      <NewTemplateForm positions={positions} locale={locale} />
    </div>
  )
}
