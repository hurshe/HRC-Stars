import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function ForbiddenPage() {
  const t = await getTranslations('errors.forbidden')

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block text-sm text-foreground underline underline-offset-4"
      >
        ← HRC STARS
      </Link>
    </div>
  )
}
