'use client'

import { useActionState, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input, Select } from '@/components/ui/field'
import {
  addStepAction,
  enrollAction,
  moveStepAction,
  removeStepAction,
  setProgramActiveAction,
  type ProgramFormState,
} from '../actions'

type Person = { id: string; firstName: string; lastName: string }
type Material = { id: string; title: string }

const initialState: ProgramFormState = {}
const STEP_TYPES = ['DOCUMENT', 'TEST', 'PRACTICE'] as const
type StepType = (typeof STEP_TYPES)[number]

export function StepControls({
  stepId,
  isFirst,
  isLast,
}: {
  stepId: string
  isFirst: boolean
  isLast: boolean
}) {
  const t = useTranslations('programs.detail')
  const tErrors = useTranslations('programs.errors')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Удаление в два нажатия: вместе с шагом пропадают отметки куратора
  const [confirming, setConfirming] = useState(false)

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok && result.error) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        disabled={pending || isFirst}
        onClick={() => run(() => moveStepAction(stepId, 'up'))}
        aria-label={t('moveUp')}
        title={t('moveUp')}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending || isLast}
        onClick={() => run(() => moveStepAction(stepId, 'down'))}
        aria-label={t('moveDown')}
        title={t('moveDown')}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      {confirming ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => removeStepAction(stepId))}
          onBlur={() => setConfirming(false)}
        >
          {t('removeConfirm')}
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(true)}
          aria-label={t('remove')}
          title={t('remove')}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      )}
      {error && <span className="text-xs text-danger">{tErrors(error)}</span>}
    </div>
  )
}

export function AddStepForm({
  programId,
  documents,
  tests,
}: {
  programId: string
  documents: Material[]
  tests: Material[]
}) {
  const t = useTranslations('programs.detail')
  const tPrograms = useTranslations('programs')
  const tErrors = useTranslations('programs.errors')
  const [type, setType] = useState<StepType>('DOCUMENT')
  const [state, formAction, pending] = useActionState(addStepAction, initialState)

  const materials = type === 'DOCUMENT' ? documents : type === 'TEST' ? tests : null

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-(--radius-control) border border-dashed border-border-strong p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">{t('addStep')}</h3>
      <input type="hidden" name="programId" value={programId} />
      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('stepType')} htmlFor="step-type">
          <Select
            id="step-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as StepType)}
          >
            {STEP_TYPES.map((value) => (
              <option key={value} value={value}>
                {tPrograms(`stepType.${value}`)}
              </option>
            ))}
          </Select>
        </Field>

        {materials && (
          <Field
            label={type === 'DOCUMENT' ? t('document') : t('test')}
            htmlFor="step-material"
            required
          >
            {/* key сбрасывает выбор при смене типа: id документа в списке тестов не нужен */}
            <Select
              key={type}
              id="step-material"
              name={type === 'DOCUMENT' ? 'documentId' : 'testId'}
              required
              defaultValue=""
            >
              <option value="" disabled>
                {t('choose')}
              </option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <Field
        label={t('stepTitle')}
        htmlFor="step-title"
        required={type === 'PRACTICE'}
        hint={type === 'PRACTICE' ? undefined : t('stepTitleHint')}
      >
        <Input id="step-title" name="title" required={type === 'PRACTICE'} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="required"
          defaultChecked
          className="size-4 accent-[var(--primary)]"
        />
        {t('requiredStep')}
      </label>

      <Button type="submit" size="sm" loading={pending}>
        {t('addSubmit')}
      </Button>
    </form>
  )
}

export function EnrollForm({
  programId,
  participants,
  mentors,
}: {
  programId: string
  participants: Person[]
  mentors: Person[]
}) {
  const t = useTranslations('programs.detail')
  const tPrograms = useTranslations('programs')
  const tErrors = useTranslations('programs.errors')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(enrollAction, initialState)

  const userError = state.fieldErrors?.userId

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-(--radius-control) border border-dashed border-border-strong p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">{t('enroll')}</h3>
      <input type="hidden" name="programId" value={programId} />
      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label={t('participant')}
          htmlFor="enroll-user"
          required
          error={userError && tValidation.has(userError) ? tValidation(userError) : undefined}
        >
          <Select id="enroll-user" name="userId" required defaultValue="">
            <option value="" disabled>
              {t('choose')}
            </option>
            {participants.map((person) => (
              <option key={person.id} value={person.id}>
                {person.lastName} {person.firstName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('mentor')} htmlFor="enroll-mentor">
          <Select id="enroll-mentor" name="mentorId" defaultValue="">
            <option value="">{tPrograms('noMentor')}</option>
            {mentors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.lastName} {person.firstName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('dueAt')} htmlFor="enroll-due">
          <Input id="enroll-due" name="dueAt" type="date" />
        </Field>
      </div>

      <Button type="submit" size="sm" loading={pending}>
        {t('enrollSubmit')}
      </Button>
    </form>
  )
}

export function ProgramActiveToggle({
  programId,
  isActive,
}: {
  programId: string
  isActive: boolean
}) {
  const t = useTranslations('programs.detail')
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setProgramActiveAction(programId, !isActive)
        })
      }
    >
      {isActive ? t('archive') : t('restore')}
    </Button>
  )
}
