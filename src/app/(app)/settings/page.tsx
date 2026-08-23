import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { Card } from '@/components/ui/card'

export default async function SettingsPage() {
  const actor = await requirePermission('settings.view')
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('settings')

  const sections = [
    {
      href: '/settings/permissions',
      icon: ShieldCheck,
      title: t('permissions.title'),
      description: t('permissions.subtitle'),
      visible: permissions.has('settings.permissions.manage'),
    },
  ].filter((section) => section.visible)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card className="flex h-full items-start gap-3 p-4 transition-colors group-hover:border-border-strong">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-muted text-muted-foreground"
                aria-hidden
              >
                <section.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-foreground">{section.title}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
