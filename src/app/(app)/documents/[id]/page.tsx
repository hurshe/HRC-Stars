import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Download, Users } from 'lucide-react'
import { db } from '@/lib/db'
import { getPermissions, requireUser } from '@/server/auth/session'
import { getDocument } from '@/server/services/documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AssignPanel, NewVersionPanel } from './document-panels'

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default async function DocumentPage({ params }: PageProps<'/documents/[id]'>) {
  const actor = await requireUser()
  const { id } = await params

  const document = await getDocument(actor, id)
  if (!document) notFound()

  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('documents')

  const [positions, roles] = permissions.has('document.assign')
    ? await Promise.all([
        db.position.findMany({
          where: { isActive: true },
          orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
          select: { id: true, nameEn: true, namePl: true },
        }),
        db.role.findMany({
          where: { level: { lt: actor.role.level } },
          orderBy: { level: 'desc' },
          select: { id: true, code: true, nameEn: true, namePl: true },
        }),
      ])
    : [[], []]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href={`/documents?space=${document.space}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t(`spaces.${document.space}`)}
        </Link>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">{document.title}</h1>
            {document.description && (
              <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {document.category && <Badge variant="outline">{document.category.name}</Badge>}
              {document.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              {document.validUntil && (
                <Badge tone="warning">
                  {format.dateTime(document.validUntil, { dateStyle: 'medium' })}
                </Badge>
              )}
            </div>
          </div>

          {document.currentVersionId && document.versions[0]?.fileKey && (
            <Button asChild>
              <a href={`/api/documents/${document.currentVersionId}/download`}>
                <Download className="size-4" aria-hidden />
                {t('detail.download')}
              </a>
            </Button>
          )}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('detail.author')}</dt>
            <dd className="font-medium text-foreground">
              {document.createdBy.firstName} {document.createdBy.lastName}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('detail.createdAt')}</dt>
            <dd className="font-medium text-foreground">
              {format.dateTime(document.createdAt, { dateStyle: 'medium' })}
            </dd>
          </div>
        </dl>

        {document.kind === 'RICH_TEXT' && document.versions[0]?.content && (
          <div className="rounded-(--radius-control) border border-border bg-muted p-4 text-sm whitespace-pre-wrap text-foreground">
            {document.versions[0].content}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('detail.versions')}</h2>
        <ul className="space-y-2">
          {document.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {t('detail.version', { number: version.versionNumber })}
                  {version.id === document.currentVersionId && (
                    <Badge tone="success" size="sm">
                      current
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {version.author.firstName} {version.author.lastName} ·{' '}
                  {format.dateTime(version.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  {version.fileName && ` · ${version.fileName} (${formatSize(version.fileSize)})`}
                </div>
                {version.changeNote && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{version.changeNote}</div>
                )}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('detail.acknowledgedBy', { count: version._count.acknowledgements })}
                </div>
              </div>

              {version.fileKey && (
                <Button asChild variant="ghost" size="sm">
                  <a href={`/api/documents/${version.id}/download`}>
                    <Download className="size-4" aria-hidden />
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>

        {permissions.has('document.edit') && <NewVersionPanel documentId={document.id} />}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="font-display text-lg font-bold text-foreground">
            {t('detail.assignments')}
          </h2>
        </div>

        {document.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noAssignments')}</p>
        ) : (
          <ul className="space-y-1.5">
            {document.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {assignment.user
                    ? `${assignment.user.firstName} ${assignment.user.lastName}`
                    : assignment.position
                      ? locale === 'pl'
                        ? assignment.position.namePl
                        : assignment.position.nameEn
                      : (assignment.role?.code ?? '—')}
                </span>
                {assignment.requiresAcknowledgement && (
                  <Badge tone="info" size="sm">
                    {t('detail.requiresAck')}
                  </Badge>
                )}
                {assignment.dueAt && (
                  <span className="text-xs text-muted-foreground">
                    {format.dateTime(assignment.dueAt, { dateStyle: 'medium' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {permissions.has('document.assign') && (
          <AssignPanel
            documentId={document.id}
            positions={positions}
            roles={roles}
            locale={locale}
          />
        )}
      </Card>
    </div>
  )
}
