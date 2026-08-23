'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError, Input } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { openRunAction, saveItemAction, submitRunAction, verifyRunAction } from './actions'

export function OpenRunButton({ templateId }: { templateId: string }) {
  const t = useTranslations('checklists')
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => openRunAction(templateId).then(() => undefined))}
    >
      {t('open')}
    </Button>
  )
}

type Item = {
  id: string
  label: string
  hint: string | null
  type: string
  required: boolean
}

export function RunFiller({
  runId,
  items,
  initial,
  readOnly,
}: {
  runId: string
  items: Item[]
  initial: Record<string, unknown>
  readOnly: boolean
}) {
  const t = useTranslations('checklists')
  const router = useRouter()
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState<number | null>(null)

  function update(itemId: string, value: unknown) {
    setValues((current) => ({ ...current, [itemId]: value }))
    // Каждая отметка сохраняется сразу: смена может прерваться в любой момент,
    // и потерять заполненное на середине списка недопустимо
    startTransition(() => saveItemAction(runId, itemId, value).then(() => undefined))
  }

  const filled = items.filter((item) => values[item.id] !== undefined && values[item.id] !== null)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          {t('progress', { done: filled.length, total: items.length })}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${items.length ? (filled.length / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const value = values[item.id]
          const checked = value === true

          if (item.type === 'CHECKBOX') {
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    // Крупная зона нажатия: чек-лист заполняют пальцем на планшете
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-(--radius-control) border px-4 py-3',
                    checked ? 'border-success bg-success/10' : 'border-border',
                    readOnly && 'cursor-default opacity-80',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={(event) => update(item.id, event.target.checked)}
                    className="size-5 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    {item.hint && (
                      <span className="block text-xs text-muted-foreground">{item.hint}</span>
                    )}
                  </span>
                  {checked && <Check className="size-5 shrink-0 text-success" aria-hidden />}
                </label>
              </li>
            )
          }

          return (
            <li
              key={item.id}
              className="space-y-1 rounded-(--radius-control) border border-border px-4 py-3"
            >
              <label
                htmlFor={`item-${item.id}`}
                className="block text-sm font-medium text-foreground"
              >
                {item.label}
              </label>
              <Input
                id={`item-${item.id}`}
                type={item.type === 'NUMBER' ? 'number' : 'text'}
                inputMode={item.type === 'NUMBER' ? 'decimal' : undefined}
                defaultValue={typeof value === 'string' || typeof value === 'number' ? value : ''}
                disabled={readOnly}
                onBlur={(event) => update(item.id, event.target.value)}
              />
            </li>
          )
        })}
      </ul>

      {error && (
        <FormError>
          {t(`errors.${error}`)}
          {missing != null && ` (${missing})`}
        </FormError>
      )}

      {!readOnly && (
        <Button
          size="lg"
          block
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await submitRunAction(runId)
              if (result.ok) {
                setError(null)
                router.refresh()
              } else {
                setError(result.error ?? null)
                setMissing(result.missing ?? null)
              }
            })
          }
        >
          {t('submit')}
        </Button>
      )}
    </div>
  )
}

export function VerifyButton({ runId }: { runId: string }) {
  const t = useTranslations('checklists')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await verifyRunAction(runId)
          router.refresh()
        })
      }
    >
      {t('verify')}
    </Button>
  )
}
