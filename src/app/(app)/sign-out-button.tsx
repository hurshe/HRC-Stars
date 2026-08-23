'use client'

import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOutAction } from '@/server/actions/auth'

export function SignOutButton() {
  const t = useTranslations('common')

  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm" aria-label={t('signOut')}>
        <LogOut className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t('signOut')}</span>
      </Button>
    </form>
  )
}
