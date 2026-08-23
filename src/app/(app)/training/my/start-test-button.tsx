'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { startAttemptAction } from '../actions'

export function StartTestButton({ testId }: { testId: string }) {
  const t = useTranslations('training.attempt')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            // Успешный старт делает redirect и сюда не возвращается
            const result = await startAttemptAction(testId)
            if (result && !result.ok) setError(result.error)
          })
        }
      >
        {t('start')}
      </Button>
      {error && <p className="text-xs text-danger">{t(error)}</p>}
    </div>
  )
}
