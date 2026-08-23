'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/field'
import { resendInvitationAction, toggleTrainerAction, type InviteState } from '../actions'

export function InviteActions({
  userId,
  canInvite,
}: {
  userId: string
  canInvite: boolean
}) {
  const t = useTranslations('employees.profile')
  const tErrors = useTranslations('employees.errors')
  const tCreated = useTranslations('employees.created')
  const [state, setState] = useState<InviteState | null>(null)
  const [pending, startTransition] = useTransition()

  if (!canInvite) return null

  function run(method: 'EMAIL_LINK' | 'ACTIVATION_CODE') {
    startTransition(async () => {
      setState(await resendInvitationAction(userId, method))
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run('EMAIL_LINK')}>
          <Mail className="size-4" aria-hidden />
          {t('resendEmail')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run('ACTIVATION_CODE')}
        >
          <KeyRound className="size-4" aria-hidden />
          {t('generateCode')}
        </Button>
      </div>

      {state?.error && <FormError>{tErrors(state.error)}</FormError>}

      {state?.activationCode && (
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">{tCreated('codeLabel')}</div>
          <div className="rounded-(--radius-control) border border-border-strong bg-muted px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-foreground">
            {state.activationCode}
          </div>
        </div>
      )}

      {state?.invitationUrl && (
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            {state.emailSent ? tCreated('linkLabel') : tCreated('emailFailed')}
          </div>
          <div className="rounded-(--radius-control) border border-border bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">
            {state.invitationUrl}
          </div>
        </div>
      )}
    </div>
  )
}

export function TrainerToggle({
  userId,
  isTrainer,
  canManage,
}: {
  userId: string
  isTrainer: boolean
  canManage: boolean
}) {
  const t = useTranslations('employees.profile')
  const [pending, startTransition] = useTransition()

  if (!canManage) return null

  return (
    <Button
      variant={isTrainer ? 'outline' : 'secondary'}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => toggleTrainerAction(userId, !isTrainer))}
    >
      {isTrainer ? t('trainerOff') : t('trainerOn')}
    </Button>
  )
}
