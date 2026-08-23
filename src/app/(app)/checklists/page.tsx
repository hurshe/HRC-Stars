import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ClipboardCheck, Plus } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { getTodayChecklists, listTemplates } from '@/server/services/checklists'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, TableWrapper } from '@/components/ui/table'
import { OpenRunButton } from './checklist-panels'

const STATUS_TONES = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  SUBMITTED: 'warning',
  VERIFIED: 'success',
  OVERDUE: 'danger',
} as const

export default async function ChecklistsPage() {
  const actor = await requirePermission('checklist.view')
  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const t = await getTranslations('checklists')

  const [today, templates] = await Promise.all([
    getTodayChecklists(actor),
    permissions.has('checklist.template.manage') ? listTemplates(actor) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {permissions.has('checklist.template.manage') && (
          <Button asChild>
            <Link href="/checklists/new">
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{t('today')}</h2>

        {today.length === 0 ? (
          <TableWrapper>
            <EmptyState
              icon={<ClipboardCheck className="size-8" aria-hidden />}
              title={t('empty.title')}
              description={t('empty.description')}
            />
          </TableWrapper>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {today.map((template) => {
              const status = template.run?.status ?? 'NOT_STARTED'
              const done = template.run?._count.results ?? 0

              return (
                <Card key={template.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-foreground">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {template.category}
                        {template.shift && ` · ${template.shift}`}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONES[status]}>{t(`status.${status}`)}</Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {t('progress', { done, total: template._count.items })}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${template._count.items ? (done / template._count.items) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-auto">
                    {template.run && status !== 'NOT_STARTED' ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/checklists/run/${template.run.id}`}>
                          {status === 'IN_PROGRESS' ? t('continue') : t('review')}
                        </Link>
                      </Button>
                    ) : (
                      permissions.has('checklist.run') && <OpenRunButton templateId={template.id} />
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {templates.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">{t('templates')}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="p-3">
                <div className="font-medium text-foreground">{template.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t(`frequency.${template.frequency}`)} · {template._count.items} ·{' '}
                  {template.position
                    ? locale === 'pl'
                      ? template.position.namePl
                      : template.position.nameEn
                    : '—'}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
