import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { ListTodo, Plus } from 'lucide-react'
import type { TaskStatus } from '@prisma/client'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { listTasks, type TaskScope } from '@/server/services/tasks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const SCOPES: TaskScope[] = ['assigned', 'authored', 'all']

const STATUS_TONES: Record<TaskStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  NEW: 'neutral',
  IN_PROGRESS: 'info',
  DONE: 'warning',
  ACCEPTED: 'success',
  CANCELLED: 'neutral',
}

const PRIORITY_TONES = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'danger' } as const

export default async function TasksPage({ searchParams }: PageProps<'/tasks'>) {
  const actor = await requirePermission('task.view')
  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('tasks')

  const params = await searchParams
  const scope = (
    SCOPES.includes(params.scope as TaskScope) ? params.scope : 'assigned'
  ) as TaskScope

  const tasks = await listTasks(actor, { scope })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {permissions.has('task.create') && (
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {SCOPES.map((candidate) => (
          <Link
            key={candidate}
            href={`/tasks?scope=${candidate}`}
            aria-current={candidate === scope ? 'page' : undefined}
            className={cn(
              'rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors',
              candidate === scope
                ? 'bg-primary/12 text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(`tabs.${candidate}`)}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <TableWrapper>
          <EmptyState
            icon={<ListTodo className="size-8" aria-hidden />}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{t('table.task')}</TH>
                <TH>{t('table.assignee')}</TH>
                <TH>{t('table.priority')}</TH>
                <TH>{t('table.due')}</TH>
                <TH>{t('table.status')}</TH>
              </TR>
            </THead>
            <TBody>
              {tasks.map((task) => {
                return (
                  <TR key={task.id}>
                    <TD>
                      <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                        {task.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {task.author.firstName} {task.author.lastName}
                      </div>
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {task.assignee
                        ? `${task.assignee.firstName} ${task.assignee.lastName}`
                        : task.assigneePosition
                          ? locale === 'pl'
                            ? task.assigneePosition.namePl
                            : task.assigneePosition.nameEn
                          : (task.assigneeRole?.code ?? '—')}
                    </TD>
                    <TD>
                      <Badge tone={PRIORITY_TONES[task.priority]} size="sm">
                        {t(`priority.${task.priority}`)}
                      </Badge>
                    </TD>
                    <TD className="text-sm">
                      {task.dueAt ? (
                        <span className={cn(task.overdue && 'font-medium text-danger')}>
                          {format.dateTime(task.dueAt, { dateStyle: 'medium' })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONES[task.status]}>{t(`status.${task.status}`)}</Badge>
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
