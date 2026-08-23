'use client'

import { useActionState, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import {
  addQuestionAction,
  assignTestAction,
  publishVersionAction,
  recordPaperResultAction,
  type TrainingFormState,
} from '../../actions'

const initialState: TrainingFormState = {}

const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_TEXT',
  'ORDERING',
] as const

export function PublishButton({ testId, versionId }: { testId: string; versionId: string }) {
  const t = useTranslations('training')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{t(`errors.${error}`)}</span>}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await publishVersionAction(testId, versionId)
            setError(result.ok ? null : result.error)
          })
        }
      >
        {t('builder.publish')}
      </Button>
    </div>
  )
}

export function QuestionBuilder({
  testId,
  testVersionId,
}: {
  testId: string
  testVersionId: string
}) {
  const t = useTranslations('training.builder')
  const tErrors = useTranslations('training.errors')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<(typeof QUESTION_TYPES)[number]>('SINGLE_CHOICE')
  const [state, formAction, pending] = useActionState(addQuestionAction, initialState)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t('addQuestion')}
      </Button>
    )
  }

  // Подсказка к полю ответа зависит от типа: без неё непонятно,
  // что именно вводить — текст, номер или список номеров
  const answerHint =
    type === 'MULTIPLE_CHOICE' || type === 'ORDERING'
      ? t('answerHintMultiple')
      : type === 'SHORT_TEXT'
        ? t('answerHintText')
        : type === 'TRUE_FALSE'
          ? 'true / false'
          : t('answerHintChoice')

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-(--radius-control) border border-border p-3"
    >
      <input type="hidden" name="testVersionId" value={testVersionId} />
      <input type="hidden" name="testId" value={testId} />

      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label={t('type')} htmlFor="type">
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            {QUESTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`types.${value}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('points')} htmlFor="points">
          <Input id="points" name="points" type="number" min={1} max={100} defaultValue={1} />
        </Field>
      </div>

      <Field label={t('questionText')} htmlFor="text" required>
        <Textarea id="text" name="text" required />
      </Field>

      {type !== 'TRUE_FALSE' && type !== 'SHORT_TEXT' && (
        <Field label={t('options')} htmlFor="options" hint={t('optionsHint')}>
          <Textarea id="options" name="options" className="min-h-28" />
        </Field>
      )}

      <Field label={t('answer')} htmlFor="answer" hint={answerHint} required>
        <Input id="answer" name="answer" required />
      </Field>

      <Field label={t('explanation')} htmlFor="explanation">
        <Input id="explanation" name="explanation" />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          {tCommon('save')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  )
}

export function AssignTestPanel({
  testId,
  positions,
  roles,
  locale,
}: {
  testId: string
  positions: { id: string; nameEn: string; namePl: string }[]
  roles: { id: string; code: string }[]
  locale: string
}) {
  const t = useTranslations('training.builder')
  const tCommon = useTranslations('common')
  const [state, formAction, pending] = useActionState(assignTestAction, initialState)
  const tErrors = useTranslations('training.errors')

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-(--radius-control) border border-border p-3"
    >
      <input type="hidden" name="testId" value={testId} />

      <div className="min-w-52 flex-1">
        <Field label={t('assign')} htmlFor="target">
          <Select id="target" name="target" defaultValue="">
            <option value="" disabled>
              —
            </option>
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
      </div>

      <div className="w-36">
        <Field label={t('repeatEvery')} htmlFor="repeatEveryDays">
          <Input id="repeatEveryDays" name="repeatEveryDays" type="number" min={1} />
        </Field>
      </div>

      <label className="flex h-11 items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="mandatory"
          defaultChecked
          className="size-4 accent-[var(--primary)]"
        />
        {t('mandatory')}
      </label>

      <Button type="submit" loading={pending}>
        {tCommon('save')}
      </Button>

      {state.error && <FormError>{tErrors(state.error)}</FormError>}
    </form>
  )
}

export function PaperResultPanel({
  testId,
  testVersionId,
  maxScore,
  employees,
}: {
  testId: string
  testVersionId: string
  maxScore: number
  employees: { id: string; firstName: string; lastName: string }[]
}) {
  const t = useTranslations('training.builder')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('training.errors')
  const [state, formAction, pending] = useActionState(recordPaperResultAction, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="testVersionId" value={testVersionId} />

      <div className="min-w-52 flex-1">
        <Field label={t('employee')} htmlFor="userId" required>
          <Select id="userId" name="userId" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="w-32">
        <Field label={`${t('score')} / ${maxScore}`} htmlFor="score" required>
          <Input id="score" name="score" type="number" min={0} max={maxScore} step="0.5" required />
        </Field>
      </div>

      <div className="w-40">
        <Field label={tCommon('save')} htmlFor="date">
          <Input id="date" name="date" type="date" />
        </Field>
      </div>

      <Button type="submit" loading={pending}>
        {tCommon('save')}
      </Button>

      {state.error && <FormError>{tErrors(state.error)}</FormError>}
    </form>
  )
}
