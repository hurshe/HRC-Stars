'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { createProgramAction, type ProgramFormState } from '../actions'

const initialState: ProgramFormState = {}
const TYPES = ['ONBOARDING', 'MIT', 'CUSTOM'] as const

export function NewProgramForm({
  positions,
  locale,
}: {
  positions: { id: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const t = useTranslations('programs.new')
  const tPrograms = useTranslations('programs')
  const tErrors = useTranslations('programs.errors')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(createProgramAction, initialState)

  const nameError = state.fieldErrors?.name

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <FormError>{tErrors(state.error)}</FormError>}

      <Card className="space-y-4 p-5">
        <Field
          label={t('name')}
          htmlFor="name"
          required
          error={nameError && tValidation.has(nameError) ? tValidation(nameError) : undefined}
        >
          <Input id="name" name="name" required autoFocus placeholder={t('namePlaceholder')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('type')} htmlFor="type" hint={t('typeHint')}>
            <Select id="type" name="type" defaultValue="ONBOARDING">
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {tPrograms(`type.${type}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('position')} htmlFor="positionId">
            <Select id="positionId" name="positionId" defaultValue="">
              <option value="">{t('positionAny')}</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {locale === 'pl' ? position.namePl : position.nameEn}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('description')} htmlFor="description">
          <Textarea id="description" name="description" />
        </Field>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/programs/all">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
