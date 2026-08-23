'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DocumentSpace } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { createDocumentAction, type DocumentFormState } from '../actions'

const initialState: DocumentFormState = {}

export function DocumentForm({
  spaces,
  defaultSpace,
  categories,
}: {
  spaces: DocumentSpace[]
  defaultSpace: DocumentSpace
  categories: { id: string; name: string }[]
}) {
  const t = useTranslations('documents.new')
  const tDocs = useTranslations('documents')
  const tCommon = useTranslations('common')
  const tValidation = useTranslations('validation')
  const [state, formAction, pending] = useActionState(createDocumentAction, initialState)

  // Файл или текст — взаимоисключающие: показывать оба поля сразу
  // значит провоцировать заполнить оба и потом гадать, что сохранится
  const [kind, setKind] = useState<'FILE' | 'RICH_TEXT'>('FILE')

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] && tValidation.has(state.fieldErrors[name])
      ? tValidation(state.fieldErrors[name], { min: 10, length: 6 })
      : state.fieldErrors?.[name]

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <FormError>{tDocs(`errors.${state.error}`)}</FormError>}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('space')} htmlFor="space" required>
            <Select id="space" name="space" defaultValue={defaultSpace}>
              {spaces.map((space) => (
                <option key={space} value={space}>
                  {tDocs(`spaces.${space}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('category')} htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue="">
              <option value="">{t('notSelected')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('documentTitle')} htmlFor="title" required error={fieldError('title')}>
          <Input id="title" name="title" required autoFocus />
        </Field>

        <Field label={t('description')} htmlFor="description">
          <Textarea id="description" name="description" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('tags')} htmlFor="tags" hint={t('tagsHint')}>
            <Input id="tags" name="tags" placeholder="handbook, 2026" />
          </Field>
          <Field label={t('validUntil')} htmlFor="validUntil">
            <Input id="validUntil" name="validUntil" type="date" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Field label={t('kind')} htmlFor="kind">
          <Select
            id="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as 'FILE' | 'RICH_TEXT')}
          >
            <option value="FILE">{t('kindFile')}</option>
            <option value="RICH_TEXT">{t('kindText')}</option>
          </Select>
        </Field>

        {kind === 'FILE' ? (
          <Field label={t('file')} htmlFor="file" hint={t('fileHint')}>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.mp4,.txt"
              className="py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground"
            />
          </Field>
        ) : (
          <Field label={t('content')} htmlFor="content">
            <Textarea id="content" name="content" className="min-h-64" />
          </Field>
        )}
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          {t('submit')}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/documents">{tCommon('cancel')}</Link>
        </Button>
      </div>
    </form>
  )
}
