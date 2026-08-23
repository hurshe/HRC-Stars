'use client'

import { useActionState, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { TaskStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Field, FormError, Textarea } from '@/components/ui/field'
import { addTaskCommentAction, changeTaskStatusAction, type TaskFormState } from '../actions'

export function TaskActions({
  taskId,
  status,
  isAuthor,
  isAssignee,
  requiresApproval,
}: {
  taskId: string
  status: TaskStatus
  isAuthor: boolean
  isAssignee: boolean
  requiresApproval: boolean
}) {
  const t = useTranslations('tasks.detail')
  const tErrors = useTranslations('tasks.errors')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(next: TaskStatus) {
    setError(null)
    startTransition(async () => {
      const result = await changeTaskStatusAction(taskId, next)
      if (!result.ok) setError(result.error)
    })
  }

  const finished = status === 'ACCEPTED' || status === 'CANCELLED'
  if (finished) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isAssignee && status === 'NEW' && (
          <Button size="sm" disabled={pending} onClick={() => run('IN_PROGRESS')}>
            {t('take')}
          </Button>
        )}

        {isAssignee && (status === 'NEW' || status === 'IN_PROGRESS') && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run('DONE')}>
            {t('complete')}
          </Button>
        )}

        {/* Принять может только автор, и только когда приёмка вообще нужна */}
        {isAuthor && requiresApproval && status === 'DONE' && (
          <Button size="sm" disabled={pending} onClick={() => run('ACCEPTED')}>
            {t('accept')}
          </Button>
        )}

        {isAuthor && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run('CANCELLED')}>
            {t('cancel')}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{tErrors(error)}</p>}
    </div>
  )
}

const initialState: TaskFormState = {}

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const t = useTranslations('tasks.detail')
  const tErrorsTask = useTranslations('tasks.errors')
  const [state, formAction, pending] = useActionState(addTaskCommentAction, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      {state.error && <FormError>{tErrorsTask(state.error)}</FormError>}

      <Field label={t('addComment')} htmlFor="text">
        <Textarea id="text" name="text" className="min-h-20" />
      </Field>

      <Button type="submit" size="sm" loading={pending}>
        {t('send')}
      </Button>
    </form>
  )
}
