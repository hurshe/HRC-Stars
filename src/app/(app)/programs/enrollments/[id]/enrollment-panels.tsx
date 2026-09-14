'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  acknowledgeStepAction,
  cancelEnrollmentAction,
  completeEnrollmentAction,
  setPracticeStepAction,
} from '../../actions'

type ActionResult = { ok: boolean; error?: string } | undefined

/// Общая обвязка кнопки с серверным действием: ожидание и текст ошибки
function useServerAction() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result && !result.ok && result.error) setError(result.error)
    })
  }

  return { pending, error, run }
}

function ActionError({ error }: { error: string | null }) {
  const t = useTranslations('programs.errors')
  if (!error) return null
  return <p className="text-xs text-danger">{t(error)}</p>
}

export function AcknowledgeStepButton({ enrollmentId, stepId }: { enrollmentId: string; stepId: string }) {
  const t = useTranslations('programs.enrollment')
  const { pending, error, run } = useServerAction()

  return (
    <div className="space-y-1">
      <Button size="sm" disabled={pending} onClick={() => run(() => acknowledgeStepAction(enrollmentId, stepId))}>
        {t('acknowledge')}
      </Button>
      <ActionError error={error} />
    </div>
  )
}

export function PracticeToggle({
  enrollmentId,
  stepId,
  done,
}: {
  enrollmentId: string
  stepId: string
  done: boolean
}) {
  const t = useTranslations('programs.enrollment')
  const { pending, error, run } = useServerAction()

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant={done ? 'ghost' : 'primary'}
        disabled={pending}
        onClick={() => run(() => setPracticeStepAction(enrollmentId, stepId, !done))}
      >
        {done ? t('unverify') : t('verify')}
      </Button>
      <ActionError error={error} />
    </div>
  )
}

export function IssueCertificateButton({ enrollmentId, ready }: { enrollmentId: string; ready: boolean }) {
  const t = useTranslations('programs.enrollment')
  const { pending, error, run } = useServerAction()

  return (
    <div className="space-y-1">
      <Button
        disabled={!ready || pending}
        loading={pending}
        onClick={() => run(() => completeEnrollmentAction(enrollmentId))}
      >
        <Award className="size-4" aria-hidden />
        {t('issue')}
      </Button>
      {!ready && <p className="text-xs text-muted-foreground">{t('issueHint')}</p>}
      <ActionError error={error} />
    </div>
  )
}

export function CancelEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const t = useTranslations('programs.enrollment')
  const { pending, error, run } = useServerAction()
  // Выписка удаляет прогресс участника, поэтому в два нажатия
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="space-y-1">
      {confirming ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => cancelEnrollmentAction(enrollmentId))}
          >
            {t('cancelConfirm')}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            {t('cancelNo')}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          {t('cancel')}
        </Button>
      )}
      <ActionError error={error} />
    </div>
  )
}
