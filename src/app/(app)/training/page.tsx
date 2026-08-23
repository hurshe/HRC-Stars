import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { GraduationCap, Plus } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { listTests } from '@/server/services/tests'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { TrainingTabs } from './training-tabs'

export default async function TrainingPage({ searchParams }: PageProps<'/training'>) {
  const actor = await requirePermission('test.view')
  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('training')

  const params = await searchParams
  const search = typeof params.search === 'string' ? params.search : undefined
  const tests = await listTests(actor, search)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {permissions.has('test.create') && (
          <Button asChild>
            <Link href="/training/tests/new">
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <TrainingTabs canSeeMatrix={permissions.has('test.result.view')} />

      {tests.length === 0 ? (
        <TableWrapper>
          <EmptyState
            icon={<GraduationCap className="size-8" aria-hidden />}
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
                <TH>{t('table.positions')}</TH>
                <TH>{t('table.questions')}</TH>
                <TH>{t('table.attempts')}</TH>
                <TH>{t('table.status')}</TH>
              </TR>
            </THead>
            <TBody>
              {tests.map((test) => {
                const latest = test.versions[0]
                const published = test.versions.find((version) => version.isPublished)
                return (
                  <TR key={test.id}>
                    <TD>
                      <Link
                        href={`/training/tests/${test.id}`}
                        className="font-medium hover:underline"
                      >
                        {test.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {format.dateTime(test.updatedAt, { dateStyle: 'medium' })}
                      </div>
                    </TD>
                    <TD className="text-sm text-muted-foreground">{test.category ?? '—'}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {test.assignments
                          .map((assignment) => assignment.position)
                          .filter((position): position is NonNullable<typeof position> =>
                            Boolean(position),
                          )
                          .map((position) => (
                            <Badge key={position.code} variant="outline" size="sm">
                              {locale === 'pl' ? position.namePl : position.nameEn}
                            </Badge>
                          ))}
                      </div>
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {latest?._count.questions ?? 0}
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {test.versions.reduce((sum, version) => sum + version._count.attempts, 0)}
                    </TD>
                    <TD>
                      <Badge tone={published ? 'success' : 'neutral'}>
                        {published ? t('status.published') : t('status.draft')}
                      </Badge>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  )
}
