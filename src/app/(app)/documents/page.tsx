import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { FileText, Lock, Plus } from 'lucide-react'
import type { DocumentSpace } from '@prisma/client'
import { getPermissions, requireUser } from '@/server/auth/session'
import {
  DOCUMENT_SPACES,
  canAccessSpace,
  listCategories,
  listDocuments,
  permissionForSpace,
} from '@/server/services/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DocumentSearch } from './document-search'

function isSpace(value: unknown): value is DocumentSpace {
  return typeof value === 'string' && (DOCUMENT_SPACES as readonly string[]).includes(value)
}

export default async function DocumentsPage({ searchParams }: PageProps<'/documents'>) {
  const actor = await requireUser()
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('documents')
  const format = await getFormatter()

  const params = await searchParams
  const space: DocumentSpace = isSpace(params.space) ? params.space : 'GENERAL'
  const search = typeof params.search === 'string' ? params.search : undefined
  const categoryId = typeof params.categoryId === 'string' ? params.categoryId : undefined

  // Вкладки показываем только те, к которым есть доступ: пустая вкладка
  // с надписью «нет прав» раздражает сильнее, чем её отсутствие
  const visibleSpaces = DOCUMENT_SPACES.filter((candidate) =>
    permissions.has(permissionForSpace(candidate)),
  )
  const hasAccess = await canAccessSpace(actor, space)

  const [documents, categories] = await Promise.all([
    hasAccess ? listDocuments(actor, { space, search, categoryId }) : Promise.resolve([]),
    listCategories(space),
  ])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {permissions.has('document.create') && hasAccess && (
          <Button asChild>
            <Link href={`/documents/new?space=${space}`}>
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {visibleSpaces.map((candidate) => (
          <Link
            key={candidate}
            href={`/documents?space=${candidate}`}
            aria-current={candidate === space ? 'page' : undefined}
            className={cn(
              'rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors',
              candidate === space
                ? 'bg-primary/12 text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {candidate === 'HR' && <Lock className="mr-1 inline size-3.5" aria-hidden />}
            {t(`spaces.${candidate}`)}
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t(`spaceHints.${space}`)}</p>

      {!hasAccess ? (
        <TableWrapper>
          <EmptyState icon={<Lock className="size-8" aria-hidden />} title={t('noAccess')} />
        </TableWrapper>
      ) : (
        <>
          <DocumentSearch categories={categories} />

          {documents.length === 0 ? (
            <TableWrapper>
              <EmptyState
                icon={<FileText className="size-8" aria-hidden />}
                title={t('empty.title')}
                description={t('empty.description')}
              />
            </TableWrapper>
          ) : (
            <TableWrapper>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>{t('table.title')}</TH>
                    <TH>{t('table.category')}</TH>
                    <TH>{t('table.version')}</TH>
                    <TH>{t('table.assigned')}</TH>
                    <TH>{t('table.updated')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {documents.map((document) => (
                    <TR key={document.id}>
                      <TD>
                        <Link
                          href={`/documents/${document.id}`}
                          className="font-medium hover:underline"
                        >
                          {document.title}
                        </Link>
                        {document.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {document.tags.map((tag) => (
                              <Badge key={tag} size="sm">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {document.category?.name ?? '—'}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        v{document.currentVersion?.versionNumber ?? 1}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {document._count.assignments}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {format.dateTime(document.updatedAt, { dateStyle: 'medium' })}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          )}
        </>
      )}
    </div>
  )
}
