import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { getTest } from '@/server/services/tests'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AssignTestPanel, PaperResultPanel, PublishButton, QuestionBuilder } from './test-panels'

export default async function TestPage({ params }: PageProps<'/training/tests/[id]'>) {
  const actor = await requirePermission('test.view')
  const { id } = await params

  const test = await getTest(actor, id)
  if (!test) notFound()

  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const t = await getTranslations('training')

  // Работаем с самой свежей версией: опубликованная неизменна,
  // черновик — то, что редактируется
  const version = test.versions[0]
  const canEdit = permissions.has('test.edit') && version && !version.isPublished

  const [positions, roles, employees] = permissions.has('test.assign')
    ? await Promise.all([
        db.position.findMany({
          where: { isActive: true },
          orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
          select: { id: true, nameEn: true, namePl: true },
        }),
        db.role.findMany({
          where: { level: { lt: actor.role.level } },
          orderBy: { level: 'desc' },
          select: { id: true, code: true },
        }),
        db.user.findMany({
          where: { locationId: actor.locationId, deletedAt: null, status: { not: 'ARCHIVED' } },
          orderBy: { lastName: 'asc' },
          select: { id: true, firstName: true, lastName: true },
        }),
      ])
    : [[], [], []]

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/training"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('title')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-foreground">{test.title}</h1>
          {test.category && <Badge variant="outline">{test.category}</Badge>}
          {version && (
            <Badge tone={version.isPublished ? 'success' : 'neutral'}>
              v{version.versionNumber} · {version.isPublished ? t('status.published') : t('status.draft')}
            </Badge>
          )}
        </div>
        {test.description && (
          <p className="mt-1 text-sm text-muted-foreground">{test.description}</p>
        )}
      </div>

      {version && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-foreground">
              {t('builder.questions')} ({version.questions.length})
            </h2>
            {version.isPublished ? (
              <span className="text-sm text-muted-foreground">
                {t('builder.maxScore', { score: version.maxScore })}
              </span>
            ) : (
              permissions.has('test.edit') && (
                <PublishButton testId={test.id} versionId={version.id} />
              )
            )}
          </div>

          {version.isPublished && (
            <p className="rounded-(--radius-control) border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t('builder.published')}
            </p>
          )}

          {version.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('builder.noQuestions')}</p>
          ) : (
            <ol className="space-y-2">
              {version.questions.map((link, index) => (
                <li
                  key={link.id}
                  className="rounded-(--radius-control) border border-border px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {index + 1}. {link.question.text}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t(`builder.types.${link.question.type}`)} · {link.points} pt
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {canEdit && <QuestionBuilder testId={test.id} testVersionId={version.id} />}
        </Card>
      )}

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">
          {t('builder.assignments')}
        </h2>

        {test.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('builder.noAssignments')}</p>
        ) : (
          <ul className="space-y-1.5">
            {test.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {assignment.position
                    ? locale === 'pl'
                      ? assignment.position.namePl
                      : assignment.position.nameEn
                    : assignment.user
                      ? `${assignment.user.firstName} ${assignment.user.lastName}`
                      : (assignment.role?.code ?? '—')}
                </span>
                {assignment.mandatory && (
                  <Badge tone="info" size="sm">
                    {t('builder.mandatory')}
                  </Badge>
                )}
                {assignment.repeatEveryDays && (
                  <span className="text-xs text-muted-foreground">
                    {t('builder.repeatEvery')}: {assignment.repeatEveryDays}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {permissions.has('test.assign') && (
          <AssignTestPanel
            testId={test.id}
            positions={positions}
            roles={roles}
            locale={locale}
          />
        )}
      </Card>

      {permissions.has('test.result.enter') && version?.isPublished && (
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {t('builder.paperResult')}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('builder.paperHint')}</p>
          </div>
          <PaperResultPanel
            testId={test.id}
            testVersionId={version.id}
            maxScore={version.maxScore}
            employees={employees}
          />
        </Card>
      )}
    </div>
  )
}
