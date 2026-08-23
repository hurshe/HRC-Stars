import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPermissions, requireUser } from '@/server/auth/session'
import { listMyTests } from '@/server/services/tests'
import { Badge, toneForScore } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState, TableWrapper } from '@/components/ui/table'
import { getSettingNumber } from '@/server/services/settings'
import { TrainingTabs } from '../training-tabs'
import { StartTestButton } from './start-test-button'

export default async function MyTestsPage() {
  const actor = await requireUser()
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('training')
  const format = await getFormatter()

  const [items, warning] = await Promise.all([
    listMyTests(actor),
    getSettingNumber('test.default_pass_threshold', 80),
  ])
  const bands = { danger: 60, warning }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('my.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <TrainingTabs canSeeMatrix={permissions.has('test.result.view')} />

      {items.length === 0 ? (
        <TableWrapper>
          <EmptyState title={t('my.empty')} />
        </TableWrapper>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.test.id} className="flex flex-col gap-3 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{item.test.title}</h2>
                  {item.test.category && (
                    <Badge variant="outline" size="sm">
                      {item.test.category}
                    </Badge>
                  )}
                  {item.mandatory && (
                    <Badge tone="info" size="sm">
                      {t('builder.mandatory')}
                    </Badge>
                  )}
                </div>
                {item.test.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.test.description}</p>
                )}
              </div>

              <div className="text-sm">
                {item.best?.percent != null ? (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={toneForScore(item.best.percent, bands)} variant="solid">
                      {item.best.percent}%
                    </Badge>
                    <span className="text-muted-foreground">
                      {item.best.passed ? t('attempt.passed') : t('attempt.failed')}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('my.notTaken')}</span>
                )}
              </div>

              {item.dueAt && (
                <div className="text-xs text-muted-foreground">
                  {t('my.due', { date: format.dateTime(item.dueAt, { dateStyle: 'medium' }) })}
                </div>
              )}

              <div className="mt-auto">
                {item.openAttemptId ? (
                  <Link
                    href={`/training/attempt/${item.openAttemptId}`}
                    className="inline-flex h-11 items-center rounded-(--radius-control) bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    {t('attempt.continue')}
                  </Link>
                ) : item.published ? (
                  <StartTestButton testId={item.test.id} />
                ) : (
                  <span className="text-xs text-muted-foreground">{t('attempt.notPublished')}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
