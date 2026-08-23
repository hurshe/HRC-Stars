import { getLocale } from 'next-intl/server'
import type { CurrentUser } from '@/server/auth/session'
import { PositionBadges } from './position-badges'
import { SignOutButton } from './sign-out-button'

function initials(user: CurrentUser): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

export async function UserCard({ user }: { user: CurrentUser }) {
  const locale = await getLocale()

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-foreground"
        aria-hidden
      >
        {initials(user)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{user.fullName}</div>
        <PositionBadges
          positions={user.positions}
          isTrainer={user.isTrainer}
          locale={locale}
          align="start"
        />
      </div>

      <SignOutButton />
    </div>
  )
}
