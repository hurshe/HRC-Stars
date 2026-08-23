'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { createTemplateAction, type ChecklistFormState } from '../actions'

const initialState: ChecklistFormState = {}

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'] as const

export function NewTemplateForm({
  positions,
  locale,
}: {
  positions: { id: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const t = useTranslations('checklists.new')
  const tChecklists = useTranslations('checklists')
  const tCommon = useTranslations('common')
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <FormError>{tChecklists(`errors.${state.error}`)}</FormError>}

      <Card className="space-y-4 p-5">
        <Field label={t('name')} htmlFor="name" required>
          <Input id="name" name="name" required autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('category')} htmlFor="category">
            <Input id="category" name="category" placeholder="Operations" />
          </Field>
          <Field label={t('shift')} htmlFor="shift">
            <Input id="shift" name="shift" placeholder="OPENING" />
          </Field>
          <Field label={t('frequency')} htmlFor="frequency">
            <Select id="frequency" name="frequency" defaultValue="DAILY">
              {FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {tChecklists(`frequency.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('position')} htmlFor="positionId">
            <Select id="positionId" name="positionId" defaultValue="">
              <option value="">—</option>
              {positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {locale === 'pl' ? position.namePl : position.nameEn}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="requiresVerification"
            className="size-4 accent-[var(--primary)]"
          />
          {t('requiresVerification')}
        </label>
      </Card>

      <Card className="space-y-3 p-5">
        <Field label={t('items')} htmlFor="items" hint={t('itemsHint')} required>
          <Textarea
            id="items"
            name="items"
            required
            className="min-h-56"
            placeholder={'Check beer taps\nCheck fridge temperature\nCheck POS system'}
          />
        </Field>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/checklists">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
