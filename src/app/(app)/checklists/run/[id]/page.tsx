import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { getRun } from '@/server/services/checklists'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RunFiller, VerifyButton } from '../../checklist-panels'

export default async function ChecklistRunPage({ params }: PageProps<'/checklists/run/[id]'>) {
  const actor = await requirePermission('checklist.view')
  const { id } = await params

  const run = await getRun(actor, id)
  if (!run) notFound()

  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('checklists')
  const format = await getFormatter()

  const readOnly = run.status === 'SUBMITTED' || run.status === 'VERIFIED'
  const initial = Object.fromEntries(run.results.map((result) => [result.itemId, result.value]))

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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-foreground">{run.template.name}</h1>
          <Badge tone={run.status === 'VERIFIED' ? 'success' : 'info'}>
            {t(`status.${run.status}`)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {format.dateTime(run.businessDate, { dateStyle: 'full' })}
          {run.shift && ` · ${run.shift}`}
        </p>
      </div>

      <Card className="p-5">
        <RunFiller
          runId={run.id}
          items={run.template.items}
          initial={initial}
          readOnly={readOnly}
        />
      </Card>

      {run.status === 'SUBMITTED' && permissions.has('checklist.verify') && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-sm text-muted-foreground">
            {run.submittedAt &&
              t('submitted', {
                date: format.dateTime(run.submittedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
          </div>
          <VerifyButton runId={run.id} />
        </Card>
      )}

      {run.status === 'VERIFIED' && run.verifiedBy && (
        <p className="text-sm text-muted-foreground">
          {t('verifiedBy', {
            name: `${run.verifiedBy.firstName} ${run.verifiedBy.lastName}`,
          })}
        </p>
      )}
    </div>
  )
}
