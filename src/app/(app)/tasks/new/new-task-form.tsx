'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { createTaskAction, type TaskFormState } from '../actions'

const initialState: TaskFormState = {}

export function NewTaskForm({
  users,
  roles,
  positions,
  locale,
}: {
  users: { id: string; firstName: string; lastName: string }[]
  roles: { id: string; code: string }[]
  positions: { id: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const t = useTranslations('tasks.new')
  const tTasks = useTranslations('tasks')
  const tErrors = useTranslations('tasks.errors')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(createTaskAction, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <Card className="space-y-4 p-5">
        <Field
          label={t('taskTitle')}
          htmlFor="title"
          required
          error={
            state.fieldErrors?.title && tValidation.has(state.fieldErrors.title)
              ? tValidation(state.fieldErrors.title, { min: 10, length: 6 })
              : undefined
          }
        >
          <Input id="title" name="title" required autoFocus />
        </Field>

        <Field label={t('description')} htmlFor="description">
          <Textarea id="description" name="description" />
        </Field>

        <Field label={t('assignTo')} htmlFor="target" required>
          <Select id="target" name="target" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            <optgroup label="People">
              {users.map((user) => (
                <option key={user.id} value={`user:${user.id}`}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </optgroup>
            <optgroup label="Position">
              {positions.map((position) => (
                <option key={position.id} value={`position:${position.id}`}>
                  {locale === 'pl' ? position.namePl : position.nameEn}
                </option>
              ))}
            </optgroup>
            <optgroup label="Role">
              {roles.map((role) => (
                <option key={role.id} value={`role:${role.id}`}>
                  {role.code}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('due')} htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="date" />
          </Field>
          <Field label={t('priority')} htmlFor="priority">
            <Select id="priority" name="priority" defaultValue="MEDIUM">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((value) => (
                <option key={value} value={value}>
                  {tTasks(`priority.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('repeatEvery')} htmlFor="repeatEveryDays">
            <Input id="repeatEveryDays" name="repeatEveryDays" type="number" min={1} />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="requiresApproval"
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            {t('requiresApproval')}
            <span className="block text-xs text-muted-foreground">
              {t('requiresApprovalHint')}
            </span>
          </span>
        </label>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/tasks">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
