import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getTask } from '@/server/services/tasks'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TaskActions, TaskCommentForm } from './task-panels'

export default async function TaskPage({ params }: PageProps<'/tasks/[id]'>) {
  const actor = await requireUser()
  const { id } = await params

  const task = await getTask(actor, id)
  if (!task) notFound()

  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('tasks')

  const isAuthor = task.authorId === actor.id
  const isAssignee = task.assigneeId === actor.id || (!task.assigneeId && Boolean(task.assigneeRole || task.assigneePosition))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('title')}
        </Link>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">{task.title}</h1>
            {task.description && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>
          <Badge tone={task.status === 'ACCEPTED' ? 'success' : 'info'} size="md">
            {t(`status.${task.status}`)}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('detail.createdBy')}</dt>
            <dd className="font-medium text-foreground">
              {task.author.firstName} {task.author.lastName}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('table.assignee')}</dt>
            <dd className="font-medium text-foreground">
              {task.assignee
                ? `${task.assignee.firstName} ${task.assignee.lastName}`
                : task.assigneePosition
                  ? locale === 'pl'
                    ? task.assigneePosition.namePl
                    : task.assigneePosition.nameEn
                  : (task.assigneeRole?.code ?? '—')}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('table.due')}</dt>
            <dd className="font-medium text-foreground">
              {task.dueAt ? format.dateTime(task.dueAt, { dateStyle: 'medium' }) : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-border py-2">
            <dt className="text-muted-foreground">{t('table.priority')}</dt>
            <dd className="font-medium text-foreground">{t(`priority.${task.priority}`)}</dd>
          </div>
        </dl>

        <TaskActions
          taskId={task.id}
          status={task.status}
          isAuthor={isAuthor}
          isAssignee={isAssignee}
          requiresApproval={task.requiresApproval}
        />
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('detail.comments')}</h2>

        {task.comments.length > 0 && (
          <ul className="space-y-2">
            {task.comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-(--radius-control) border border-border px-3 py-2"
              >
                <div className="text-xs text-muted-foreground">
                  {comment.author.firstName} {comment.author.lastName} ·{' '}
                  {format.dateTime(comment.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground">{comment.text}</p>
              </li>
            ))}
          </ul>
        )}

        <TaskCommentForm taskId={task.id} />
      </Card>
    </div>
  )
}
