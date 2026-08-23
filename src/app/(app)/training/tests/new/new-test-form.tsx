'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Textarea } from '@/components/ui/field'
import { createTestAction, type TrainingFormState } from '../../actions'

const initialState: TrainingFormState = {}

export function NewTestForm() {
  const t = useTranslations('training.new')
  const tErrors = useTranslations('training.errors')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(createTestAction, initialState)

  const fieldError = (name: string) => {
    const code = state.fieldErrors?.[name]
    if (!code) return undefined
    return tValidation.has(code) ? tValidation(code, { min: 10, length: 6 }) : code
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <Card className="space-y-4 p-5">
        <Field label={t('testTitle')} htmlFor="title" required error={fieldError('title')}>
          <Input id="title" name="title" required autoFocus />
        </Field>

        <Field label={t('description')} htmlFor="description">
          <Textarea id="description" name="description" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('category')} htmlFor="category" hint={t('categoryHint')}>
            <Input id="category" name="category" />
          </Field>
          <Field label={t('timeLimit')} htmlFor="timeLimitMinutes">
            <Input id="timeLimitMinutes" name="timeLimitMinutes" type="number" min={1} max={600} />
          </Field>
          <Field
            label={t('passThreshold')}
            htmlFor="passThreshold"
            hint={t('passThresholdHint')}
          >
            <Input id="passThreshold" name="passThreshold" type="number" min={1} max={100} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/training">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
