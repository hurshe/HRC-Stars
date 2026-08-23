'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormError, Input, Textarea, Select } from '@/components/ui/field'
import { addVersionAction, assignDocumentAction, type DocumentFormState } from '../actions'

const initialState: DocumentFormState = {}

export function NewVersionPanel({ documentId }: { documentId: string }) {
  const t = useTranslations('documents')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(addVersionAction, initialState)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {t('detail.newVersion')}
      </Button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-(--radius-control) border border-border p-3">
      <input type="hidden" name="documentId" value={documentId} />
      {state.error && <FormError>{t(`errors.${state.error}`)}</FormError>}

      <Field label={t('new.file')} htmlFor="version-file" hint={t('new.fileHint')}>
        <Input
          id="version-file"
          name="file"
          type="file"
          className="py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground"
        />
      </Field>

      <Field label={t('new.content')} htmlFor="version-content">
        <Textarea id="version-content" name="content" />
      </Field>

      <Field label={t('detail.changeNote')} htmlFor="changeNote">
        <Input id="changeNote" name="changeNote" />
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

export function AssignPanel({
  documentId,
  positions,
  roles,
  locale,
}: {
  documentId: string
  positions: { id: string; nameEn: string; namePl: string }[]
  roles: { id: string; code: string; nameEn: string; namePl: string }[]
  locale: string
}) {
  const t = useTranslations('documents')
  const tCommon = useTranslations('common')
  const [state, formAction, pending] = useActionState(assignDocumentAction, initialState)

  const label = (item: { nameEn: string; namePl: string }) =>
    locale === 'pl' ? item.namePl : item.nameEn

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-(--radius-control) border border-border p-3"
    >
      <input type="hidden" name="documentId" value={documentId} />

      <div className="min-w-52 flex-1">
        {/* Один список вместо «выбери тип получателя, потом получателя»:
            значение кодирует и тип, и идентификатор */}
        <Field label={t('detail.assignTo')} htmlFor="target">
          <Select id="target" name="target" defaultValue="">
            <option value="" disabled>
              {t('new.notSelected')}
            </option>
            <optgroup label="Position">
              {positions.map((position) => (
                <option key={position.id} value={`position:${position.id}`}>
                  {label(position)}
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

      <div className="w-40">
        <Field label={t('my.due', { date: '' }).replace(':', '')} htmlFor="dueAt">
          <Input id="dueAt" name="dueAt" type="date" />
        </Field>
      </div>

      <label className="flex h-11 items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="requiresAcknowledgement"
          defaultChecked
          className="size-4 accent-[var(--primary)]"
        />
        {t('detail.requiresAck')}
      </label>

      <Button type="submit" size="md" loading={pending}>
        {tCommon('save')}
      </Button>

      {state.error && <FormError>{t(`errors.${state.error}`)}</FormError>}
    </form>
  )
}
