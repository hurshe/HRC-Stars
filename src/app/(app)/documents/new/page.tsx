import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import type { DocumentSpace } from '@prisma/client'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { DOCUMENT_SPACES, listCategories, permissionForSpace } from '@/server/services/documents'
import { DocumentForm } from './document-form'

export default async function NewDocumentPage({ searchParams }: PageProps<'/documents/new'>) {
  const actor = await requirePermission('document.create')
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('documents.new')
  const tDocs = await getTranslations('documents')

  const params = await searchParams
  const requested = typeof params.space === 'string' ? params.space : null

  const spaces = DOCUMENT_SPACES.filter((space) => permissions.has(permissionForSpace(space)))
  const defaultSpace = (
    requested && spaces.includes(requested as DocumentSpace) ? requested : (spaces[0] ?? 'GENERAL')
  ) as DocumentSpace

  const categories = await listCategories(defaultSpace)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tDocs('title')}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <DocumentForm spaces={spaces} defaultSpace={defaultSpace} categories={categories} />
    </div>
  )
}
